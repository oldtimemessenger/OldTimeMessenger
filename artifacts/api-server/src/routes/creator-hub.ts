import { Router, type IRouter, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  db, creatorHubProfilesTable, creatorApplicationsTable, businessVerificationsTable, uploadSlotsTable,
  creatorHubProductsTable, creatorHubCampaignsTable, creatorProductApprovalsTable,
  postProductAttachmentsTable, affiliateClicksTable, creatorHubCartsTable,
  creatorHubCartItemsTable, creatorHubOrdersTable, creatorHubOrderItemsTable,
  creatorHubReviewsTable,
  creatorHubPayoutsTable,
  usersTable,
} from "@workspace/db";
import { socialPostsTable } from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";
import { getStripePublishableKey, getUncachableStripeClient } from "../lib/stripe-client";
import { MIN_COMMISSION_BPS, commissionCents, isMediaPost } from "../lib/creator-hub-rules";
export { MIN_COMMISSION_BPS, commissionCents, isMediaPost } from "../lib/creator-hub-rules";

const router: IRouter = Router();
const productInput = z.object({ name: z.string().trim().min(1).max(200), description: z.string().max(5000).default(""), priceCents: z.number().int().nonnegative(), inventory: z.number().int().nonnegative().default(0), slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(120), imageObjectPaths: z.array(z.string().max(500)).max(12).default([]), active: z.boolean().default(true) });
const now = () => Date.now();
async function auth(req: Request, res: Response) { return requireChatAuth(req, res); }
function configuredSystemAdminIds(): Set<number> {
  return new Set(
    (process.env.OLD_TIME_SYSTEM_ADMIN_IDS ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0),
  );
}
async function admin(req: Request, res: Response) {
  const userId = await auth(req, res); if (userId === null) return null;
  if (!configuredSystemAdminIds().has(userId)) { res.status(403).json({ error: "System-admin approval is required." }); return null; }
  return userId;
}
async function cartFor(userId: number) {
  let [cart] = await db.select().from(creatorHubCartsTable).where(and(eq(creatorHubCartsTable.userId, userId), eq(creatorHubCartsTable.status, "open"))).limit(1);
  if (!cart) [cart] = await db.insert(creatorHubCartsTable).values({ userId, createdAt: now(), updatedAt: now() }).returning();
  return cart;
}
async function approvedRole(userId: number, role: "creator" | "business") {
  const [profile] = await db.select({ userId: creatorHubProfilesTable.userId })
    .from(creatorHubProfilesTable)
    .where(and(eq(creatorHubProfilesTable.userId, userId), eq(creatorHubProfilesTable.role, role), eq(creatorHubProfilesTable.verificationState, "approved"))).limit(1);
  return Boolean(profile);
}

router.get("/creator-hub/me", async (req, res) => {
  const userId = await auth(req, res); if (userId === null) return;
  const [profile] = await db.select().from(creatorHubProfilesTable).where(eq(creatorHubProfilesTable.userId, userId)).limit(1);
  const [creatorApplication] = await db.select().from(creatorApplicationsTable).where(eq(creatorApplicationsTable.userId, userId)).orderBy(desc(creatorApplicationsTable.createdAt)).limit(1);
  const [businessVerification] = await db.select().from(businessVerificationsTable).where(eq(businessVerificationsTable.userId, userId)).orderBy(desc(businessVerificationsTable.createdAt)).limit(1);
  res.json({
    profile: profile ?? null,
    creatorApplication: creatorApplication ?? null,
    businessVerification: businessVerification ?? null,
    isSystemAdmin: configuredSystemAdminIds().has(userId),
  });
});
router.post("/creator-hub/creator-applications", async (req, res) => {
  const userId = await auth(req, res); if (userId === null) return;
  const parsed = z.object({ portfolioUrl: z.string().url().max(1000).nullable().optional(), notes: z.string().max(5000).default("") }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid creator application." }); return; }
  const [row] = await db.insert(creatorApplicationsTable).values({ userId, portfolioUrl: parsed.data.portfolioUrl ?? null, notes: parsed.data.notes, createdAt: now() }).returning();
  res.status(201).json(row);
});
router.post("/creator-hub/business-verifications", async (req, res) => {
  const userId = await auth(req, res); if (userId === null) return;
  const parsed = z.object({ legalName: z.string().trim().min(1).max(200), taxIdLast4: z.string().regex(/^\d{4}$/).nullable().optional(), documentObjectPaths: z.array(z.string().min(1).max(500)).max(10).default([]) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid business verification." }); return; }
  const documentPaths = parsed.data.documentObjectPaths;
  if (documentPaths.some((path) => !path.startsWith("/objects/uploads/"))) {
    res.status(400).json({ error: "Verification documents must come from protected uploads." });
    return;
  }
  if (documentPaths.length) {
    const slots = await db.select({
      objectPath: uploadSlotsTable.objectPath,
      contentType: uploadSlotsTable.contentType,
    }).from(uploadSlotsTable).where(and(
      eq(uploadSlotsTable.userId, userId),
      inArray(uploadSlotsTable.objectPath, documentPaths),
      eq(uploadSlotsTable.status, "uploaded"),
    ));
    const documentTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
    if (slots.length !== documentPaths.length || slots.some((slot) => !documentTypes.has(slot.contentType))) {
      res.status(400).json({ error: "Each verification document must be an uploaded PDF or image owned by you." });
      return;
    }
  }
  const [row] = await db.insert(businessVerificationsTable).values({ userId, legalName: parsed.data.legalName, taxIdLast4: parsed.data.taxIdLast4 ?? null, documentObjectPaths: parsed.data.documentObjectPaths, createdAt: now() }).returning();
  res.status(201).json(row);
});
router.get("/creator-hub/shop/products/:id", async (req, res) => {
  const id = Number(req.params.id); const [product] = await db.select().from(creatorHubProductsTable).where(and(eq(creatorHubProductsTable.id, id), eq(creatorHubProductsTable.active, true))).limit(1);
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }
  const reviews = await db.select().from(creatorHubReviewsTable).where(eq(creatorHubReviewsTable.productId, id));
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;
  res.json({ ...product, reviews: { average, count: reviews.length, items: reviews } });
});
router.get("/creator-hub/shop/products", async (_req, res) => res.json(await db.select().from(creatorHubProductsTable).where(eq(creatorHubProductsTable.active, true)).orderBy(desc(creatorHubProductsTable.createdAt))));
router.get("/creator-hub/business/products", async (req, res) => {
  const userId = await auth(req, res);
  if (userId === null) return;
  if (!await approvedRole(userId, "business")) {
    res.status(403).json({ error: "Business approval is required." });
    return;
  }
  const products = await db
    .select()
    .from(creatorHubProductsTable)
    .where(eq(creatorHubProductsTable.businessUserId, userId))
    .orderBy(desc(creatorHubProductsTable.updatedAt));
  res.json(products);
});
async function owner(req: Request, res: Response, productId: number) {
  const userId = await auth(req, res); if (userId === null) return null;
  const [product] = await db.select().from(creatorHubProductsTable).where(and(eq(creatorHubProductsTable.id, productId), eq(creatorHubProductsTable.businessUserId, userId))).limit(1);
  if (!product) { res.status(404).json({ error: "Product not found." }); return null; } return { userId, product };
}
router.post("/creator-hub/business/products", async (req, res) => {
  const userId = await auth(req, res); if (userId === null) return;
  if (!await approvedRole(userId, "business")) { res.status(403).json({ error: "Business approval is required." }); return; }
  const parsed = productInput.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Invalid product." }); return; }
  const [row] = await db.insert(creatorHubProductsTable).values({ ...parsed.data, businessUserId: userId, currency: "usd", createdAt: now(), updatedAt: now() }).returning(); res.status(201).json(row);
});
router.patch("/creator-hub/business/products/:id", async (req, res) => {
  const id = Number(req.params.id); const result = await owner(req, res, id); if (!result) return;
  if (!await approvedRole(result.userId, "business")) { res.status(403).json({ error: "Business approval is required." }); return; }
  const parsed = productInput.partial().safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Invalid product." }); return; }
  const [row] = await db.update(creatorHubProductsTable).set({ ...parsed.data, updatedAt: now() }).where(eq(creatorHubProductsTable.id, id)).returning(); res.json(row);
});
router.delete("/creator-hub/business/products/:id", async (req, res) => { const result = await owner(req, res, Number(req.params.id)); if (!result) return; await db.update(creatorHubProductsTable).set({ active: false, updatedAt: now() }).where(eq(creatorHubProductsTable.id, result.product.id)); res.status(204).end(); });

router.get("/creator-hub/campaigns", async (_req, res) => res.json(await db.select().from(creatorHubCampaignsTable).where(eq(creatorHubCampaignsTable.status, "active")).orderBy(desc(creatorHubCampaignsTable.createdAt))));
router.post("/creator-hub/business/campaigns", async (req, res) => {
  const userId = await auth(req, res); if (userId === null) return;
  if (!await approvedRole(userId, "business")) { res.status(403).json({ error: "Business approval is required." }); return; }
  const p = z.object({ productId: z.number().int().positive(), name: z.string().min(1).max(200), description: z.string().max(5000).default(""), commissionBps: z.number().int().min(MIN_COMMISSION_BPS).max(10000), status: z.enum(["draft","active"]).default("draft") }).safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: "Invalid campaign." }); return; } const [product] = await db.select().from(creatorHubProductsTable).where(and(eq(creatorHubProductsTable.id,p.data.productId),eq(creatorHubProductsTable.businessUserId,userId))).limit(1); if (!product) { res.status(403).json({ error:"Only the product business may manage campaigns." }); return; }
  const [row] = await db.insert(creatorHubCampaignsTable).values({ ...p.data, businessUserId:userId, createdAt:now(), updatedAt:now() }).returning(); res.status(201).json(row);
});
router.post("/creator-hub/campaigns/:id/apply", async (req,res) => { const userId=await auth(req,res); if(userId===null)return; if(!await approvedRole(userId,"creator")){res.status(403).json({error:"Creator approval is required."});return;} const [campaign]=await db.select().from(creatorHubCampaignsTable).where(eq(creatorHubCampaignsTable.id,Number(req.params.id))).limit(1); if(!campaign){res.status(404).json({error:"Campaign not found."});return;} const [row]=await db.insert(creatorProductApprovalsTable).values({productId:campaign.productId,campaignId:campaign.id,creatorUserId:userId,commissionBps:campaign.commissionBps,createdAt:now()}).returning();res.status(201).json(row); });
router.get("/creator-hub/creator/approvals", async (req, res) => {
  const userId = await auth(req, res);
  if (userId === null) return;
  if (!await approvedRole(userId, "creator")) {
    res.status(403).json({ error: "Creator approval is required." });
    return;
  }
  const rows = await db
    .select({
      approval: creatorProductApprovalsTable,
      product: creatorHubProductsTable,
    })
    .from(creatorProductApprovalsTable)
    .innerJoin(
      creatorHubProductsTable,
      eq(creatorHubProductsTable.id, creatorProductApprovalsTable.productId),
    )
    .where(
      and(
        eq(creatorProductApprovalsTable.creatorUserId, userId),
        eq(creatorProductApprovalsTable.status, "approved"),
        eq(creatorHubProductsTable.active, true),
      ),
    )
    .orderBy(desc(creatorProductApprovalsTable.reviewedAt));
  res.json(rows.map(({ approval, product }) => ({ ...approval, product })));
});
router.get("/creator-hub/business/approvals", async (req,res) => {
  const userId=await auth(req,res); if(userId===null)return;
  if(!await approvedRole(userId,"business")){res.status(403).json({error:"Business approval is required."});return;}
  const products=await db.select({id:creatorHubProductsTable.id}).from(creatorHubProductsTable).where(eq(creatorHubProductsTable.businessUserId,userId));
  const rows=products.length?await db.select().from(creatorProductApprovalsTable).where(inArray(creatorProductApprovalsTable.productId,products.map(p=>p.id))):[];
  res.json(rows);
});
router.post("/creator-hub/business/approvals/:id/review", async (req,res) => {
  const userId=await auth(req,res); if(userId===null)return;
  if(!await approvedRole(userId,"business")){res.status(403).json({error:"Business approval is required."});return;}
  const [approval]=await db.select().from(creatorProductApprovalsTable).where(eq(creatorProductApprovalsTable.id,Number(req.params.id))).limit(1);
  if(!approval){res.status(404).json({error:"Approval not found."});return;}
  const [product]=await db.select().from(creatorHubProductsTable).where(and(eq(creatorHubProductsTable.id,approval.productId),eq(creatorHubProductsTable.businessUserId,userId))).limit(1);
  if(!product){res.status(403).json({error:"Only the product business may review approvals."});return;}
  const approved=req.body?.approved===true;
  const [campaign]=approval.campaignId?await db.select().from(creatorHubCampaignsTable).where(eq(creatorHubCampaignsTable.id,approval.campaignId)).limit(1):[];
  const referralSlug=approved?`${product.slug}-${randomBytes(16).toString("hex")}`:null;
  const [row]=await db.update(creatorProductApprovalsTable).set({status:approved?"approved":"declined",referralSlug,commissionBps:campaign?.commissionBps??MIN_COMMISSION_BPS,reviewedAt:now()}).where(eq(creatorProductApprovalsTable.id,approval.id)).returning();
  res.json(row);
});
router.post("/creator-hub/affiliate/clicks", async (req,res) => { const p=z.object({productId:z.number().int().positive(),referralSlug:z.string().max(200).nullable().optional()}).safeParse(req.body);if(!p.success){res.status(400).json({error:"Invalid click."});return;} const [approval]=p.data.referralSlug?await db.select().from(creatorProductApprovalsTable).where(and(eq(creatorProductApprovalsTable.referralSlug,p.data.referralSlug),eq(creatorProductApprovalsTable.productId,p.data.productId),eq(creatorProductApprovalsTable.status,"approved"))).limit(1):[]; const [row]=await db.insert(affiliateClicksTable).values({productId:p.data.productId,referralSlug:p.data.referralSlug??null,creatorUserId:approval?.creatorUserId??null,createdAt:now()}).returning();res.status(201).json(row); });
router.post("/creator-hub/posts/:postId/products", async(req,res)=>{
  const userId=await auth(req,res); if(userId===null)return;
  if(!await approvedRole(userId,"creator")){res.status(403).json({error:"Creator approval is required."});return;}
  const productId=Number(req.body?.productId);
  const [post]=await db.select().from(socialPostsTable).where(and(eq(socialPostsTable.id,Number(req.params.postId)),eq(socialPostsTable.authorId,userId),eq(socialPostsTable.deleted,false))).limit(1);
  const [approval]=await db.select().from(creatorProductApprovalsTable).where(and(eq(creatorProductApprovalsTable.productId,productId),eq(creatorProductApprovalsTable.creatorUserId,userId),eq(creatorProductApprovalsTable.status,"approved"))).limit(1);
  if(!post||!isMediaPost(post.media)||!approval){res.status(400).json({error:"A media post and approved product relationship are required."});return;}
  const [row]=await db.insert(postProductAttachmentsTable).values({postId:post.id,productId,creatorUserId:userId,createdAt:now()}).returning();res.status(201).json(row);
});

router.get("/creator-hub/cart", async(req,res)=>{
  const userId=await auth(req,res); if(userId===null)return;
  const cart=await cartFor(userId);
  const items=await db.select().from(creatorHubCartItemsTable).where(eq(creatorHubCartItemsTable.cartId,cart.id));
  const products=items.length?await db.select().from(creatorHubProductsTable).where(inArray(creatorHubProductsTable.id,items.map(item=>item.productId))):[];
  const byId=new Map(products.map(product=>[product.id,product]));
  res.json({...cart,items:items.map(item=>({...item,product:byId.get(item.productId)??null,lineTotalCents:(byId.get(item.productId)?.priceCents??0)*item.quantity}))});
});
router.post("/creator-hub/cart/items", async(req,res)=>{
  const userId=await auth(req,res);if(userId===null)return;
  const p=z.object({productId:z.number().int().positive(),quantity:z.number().int().positive().max(999),referralSlug:z.string().max(200).nullable().optional()}).safeParse(req.body);
  if(!p.success){res.status(400).json({error:"Invalid cart item."});return;}
  const [product]=await db.select().from(creatorHubProductsTable).where(and(eq(creatorHubProductsTable.id,p.data.productId),eq(creatorHubProductsTable.active,true))).limit(1);
  if(!product){res.status(404).json({error:"Product not found."});return;}
  let creatorUserId: number | null = null;
  if(p.data.referralSlug){
    const [approval]=await db.select().from(creatorProductApprovalsTable).where(and(eq(creatorProductApprovalsTable.productId,p.data.productId),eq(creatorProductApprovalsTable.referralSlug,p.data.referralSlug),eq(creatorProductApprovalsTable.status,"approved"))).limit(1);
    if(!approval){res.status(400).json({error:"Referral link is not valid for this product."});return;}
    creatorUserId=approval.creatorUserId;
  }
  const cart=await cartFor(userId);
  const [row]=await db.insert(creatorHubCartItemsTable).values({cartId:cart.id,productId:p.data.productId,quantity:p.data.quantity,referralSlug:p.data.referralSlug??null,creatorUserId,createdAt:now()}).onConflictDoUpdate({target:[creatorHubCartItemsTable.cartId,creatorHubCartItemsTable.productId],set:{quantity:p.data.quantity,referralSlug:p.data.referralSlug??null,creatorUserId}}).returning();
  res.status(201).json(row);
});
router.patch("/creator-hub/cart/items/:id",async(req,res)=>{const userId=await auth(req,res);if(userId===null)return;const q=Number(req.body?.quantity);if(!Number.isInteger(q)||q<1||q>999){res.status(400).json({error:"Quantity must be between 1 and 999."});return;}const cart=await cartFor(userId);const [row]=await db.update(creatorHubCartItemsTable).set({quantity:q}).where(and(eq(creatorHubCartItemsTable.id,Number(req.params.id)),eq(creatorHubCartItemsTable.cartId,cart.id))).returning();if(!row){res.status(404).json({error:"Cart item not found."});return;}res.json(row);});
router.delete("/creator-hub/cart/items/:id",async(req,res)=>{const userId=await auth(req,res);if(userId===null)return;const cart=await cartFor(userId);await db.delete(creatorHubCartItemsTable).where(and(eq(creatorHubCartItemsTable.id,Number(req.params.id)),eq(creatorHubCartItemsTable.cartId,cart.id)));res.status(204).end();});

router.post("/creator-hub/orders", async (req, res) => {
  const userId = await auth(req, res); if (userId === null) return;
  const key = String(req.header("idempotency-key") || req.body?.idempotencyKey || "");
  if (!key) { res.status(400).json({ error: "Idempotency-Key is required." }); return; }
  const [existing] = await db.select().from(creatorHubOrdersTable).where(and(eq(creatorHubOrdersTable.buyerUserId,userId),eq(creatorHubOrdersTable.idempotencyKey,key))).limit(1);
  if (existing) { res.status(200).json(existing); return; }
  try {
    const order = await db.transaction(async tx => {
      let [cart] = await tx.select().from(creatorHubCartsTable).where(and(eq(creatorHubCartsTable.userId,userId),eq(creatorHubCartsTable.status,"open"))).limit(1);
      if (!cart) throw new Error("Cart is empty.");
      const items = await tx.select().from(creatorHubCartItemsTable).where(eq(creatorHubCartItemsTable.cartId,cart.id));
      if (!items.length) throw new Error("Cart is empty.");
      const products = await tx.select().from(creatorHubProductsTable).where(inArray(creatorHubProductsTable.id,items.map(i=>i.productId)));
      const byId = new Map(products.map(p=>[p.id,p]));
      if (products.length !== items.length || items.some(i => !byId.get(i.productId)?.active || (byId.get(i.productId)?.inventory ?? 0) < i.quantity)) throw new Error("A product is unavailable or out of stock.");
      const total = items.reduce((sum,i)=>sum+byId.get(i.productId)!.priceCents*i.quantity,0);
      const [created] = await tx.insert(creatorHubOrdersTable).values({buyerUserId:userId,totalCents:total,idempotencyKey:key,createdAt:now(),updatedAt:now()}).returning();
      for (const item of items) {
        const product = byId.get(item.productId)!;
        const bps = item.referralSlug ? (await tx.select({ commissionBps: creatorProductApprovalsTable.commissionBps }).from(creatorProductApprovalsTable).where(and(eq(creatorProductApprovalsTable.productId,item.productId),eq(creatorProductApprovalsTable.referralSlug,item.referralSlug),eq(creatorProductApprovalsTable.status,"approved"))).limit(1))[0]?.commissionBps ?? 0 : 0;
        const commission = bps ? commissionCents(product.priceCents*item.quantity,bps) : 0;
        const [orderItem] = await tx.insert(creatorHubOrderItemsTable).values({orderId:created.id,productId:product.id,businessUserId:product.businessUserId,creatorUserId:item.creatorUserId,referralSlug:item.referralSlug,quantity:item.quantity,unitPriceCents:product.priceCents,commissionBps:bps || MIN_COMMISSION_BPS,commissionCents:commission}).returning();
        if (item.creatorUserId && commission > 0) {
          await tx.insert(creatorHubPayoutsTable).values({orderItemId: orderItem.id, creatorUserId:item.creatorUserId, amountCents:commission, status:"pending", createdAt:now()});
        }
        await tx.update(creatorHubProductsTable).set({inventory:product.inventory-item.quantity}).where(eq(creatorHubProductsTable.id,product.id));
      }
      await tx.update(creatorHubCartsTable).set({status:"checked_out",updatedAt:now()}).where(eq(creatorHubCartsTable.id,cart.id));
      return created;
    });
    res.status(201).json(order);
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unable to create order." }); }
});
router.get("/creator-hub/orders",async(req,res)=>{const userId=await auth(req,res);if(userId===null)return;res.json(await db.select().from(creatorHubOrdersTable).where(eq(creatorHubOrdersTable.buyerUserId,userId)).orderBy(desc(creatorHubOrdersTable.createdAt)));});
router.get("/creator-hub/orders/:id",async(req,res)=>{const userId=await auth(req,res);if(userId===null)return;const [order]=await db.select().from(creatorHubOrdersTable).where(and(eq(creatorHubOrdersTable.id,Number(req.params.id)),eq(creatorHubOrdersTable.buyerUserId,userId))).limit(1);if(!order){res.status(404).json({error:"Order not found."});return;}res.json({...order,items:await db.select().from(creatorHubOrderItemsTable).where(eq(creatorHubOrderItemsTable.orderId,order.id))});});

router.post("/creator-hub/orders/:id/checkout-preparation",async(req,res)=>{const userId=await auth(req,res);if(userId===null)return;const [order]=await db.select().from(creatorHubOrdersTable).where(and(eq(creatorHubOrdersTable.id,Number(req.params.id)),eq(creatorHubOrdersTable.buyerUserId,userId))).limit(1);if(!order){res.status(404).json({error:"Order not found."});return;}try{const [stripe,publishableKey]=await Promise.all([getUncachableStripeClient(),getStripePublishableKey()]);const intent=await stripe.paymentIntents.create({amount:order.totalCents,currency:order.currency,metadata:{orderId:String(order.id),userId:String(userId)}});if(!intent.client_secret){res.status(503).json({error:"Stripe did not return a payment secret."});return;}const [updated]=await db.update(creatorHubOrdersTable).set({paymentIntentId:intent.id,updatedAt:now()}).where(eq(creatorHubOrdersTable.id,order.id)).returning();res.json({order:updated,clientSecret:intent.client_secret,publishableKey});}catch(error){res.status(503).json({error:error instanceof Error?error.message:"Stripe is unavailable."});}});

router.get("/creator-hub/admin/queues", async (req,res) => { if (await admin(req,res) === null) return; res.json({ creatorApplications: await db.select().from(creatorApplicationsTable).where(eq(creatorApplicationsTable.status,"pending")), businessVerifications: await db.select().from(businessVerificationsTable).where(eq(businessVerificationsTable.status,"pending")) }); });
router.get("/creator-hub/dashboard", async (req,res) => {
  const userId=await auth(req,res); if(userId===null)return;
  const [profile]=await db.select().from(creatorHubProfilesTable).where(eq(creatorHubProfilesTable.userId,userId)).limit(1);
  const products=await db.select().from(creatorHubProductsTable).where(eq(creatorHubProductsTable.businessUserId,userId));
  const campaigns=await db.select().from(creatorHubCampaignsTable).where(eq(creatorHubCampaignsTable.businessUserId,userId));
  const approvals=await db.select().from(creatorProductApprovalsTable).where(eq(creatorProductApprovalsTable.creatorUserId,userId));
  const items=await db.select().from(creatorHubOrderItemsTable).where(profile?.role==="business"?eq(creatorHubOrderItemsTable.businessUserId,userId):eq(creatorHubOrderItemsTable.creatorUserId,userId));
  const clicks=await db.select().from(affiliateClicksTable).where(eq(affiliateClicksTable.creatorUserId,userId));
  res.json({role:profile?.role??null,products:products.length,campaigns:campaigns.length,approvals:approvals.length,orders:items.length,affiliateClicks:clicks.length,totalCents:items.reduce((sum,item)=>sum+item.unitPriceCents*item.quantity,0),commissionCents:items.reduce((sum,item)=>sum+item.commissionCents,0)});
});
router.get("/creator-hub/business/orders", async (req,res) => {
  const userId=await auth(req,res); if(userId===null)return;
  if(!await approvedRole(userId,"business")){res.status(403).json({error:"Business approval is required."});return;}
  const items=await db.select().from(creatorHubOrderItemsTable).where(eq(creatorHubOrderItemsTable.businessUserId,userId));
  res.json(items);
});
router.post("/creator-hub/admin/creator-applications/:id/review", async (req,res) => {
  const adminId=await admin(req,res); if(adminId===null)return;
  const approved=req.body?.approved===true; const status=approved?"approved":"rejected";
  const [row]=await db.update(creatorApplicationsTable).set({status,reviewedBy:adminId,reviewedAt:now()}).where(eq(creatorApplicationsTable.id,Number(req.params.id))).returning();
  if(!row){res.status(404).json({error:"Application not found."});return;}
  if(approved) await db.insert(creatorHubProfilesTable).values({userId:row.userId,role:"creator",verificationState:"approved",displayName:"Creator",createdAt:now(),updatedAt:now()}).onConflictDoUpdate({target:creatorHubProfilesTable.userId,set:{role:"creator",verificationState:"approved",updatedAt:now()}});
  res.json(row);
});
router.post("/creator-hub/admin/business-verifications/:id/review", async (req,res) => {
  const adminId = await admin(req, res); if (adminId === null) return;
  const approved = req.body?.approved === true;
  const status = approved ? "approved" : "rejected";
  const [row] = await db.update(businessVerificationsTable)
    .set({ status, reviewedBy: adminId, reviewedAt: now() })
    .where(eq(businessVerificationsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Verification not found." }); return; }
  if (approved) {
    await db.insert(creatorHubProfilesTable).values({
      userId: row.userId, role: "business", verificationState: "approved",
      displayName: row.legalName, createdAt: now(), updatedAt: now(),
    }).onConflictDoUpdate({
      target: creatorHubProfilesTable.userId,
      set: { role: "business", verificationState: "approved", updatedAt: now() },
    });
    await db.update(usersTable).set({
      verificationApprovedAt: now(), verificationApprovedBy: adminId,
    }).where(eq(usersTable.id, row.userId));
  }
  res.json(row);
});
router.post("/creator-hub/business/order-items/:id/shipping", async(req,res)=>{const userId=await auth(req,res);if(userId===null)return;const status=z.enum(["shipped","delivered"]).safeParse(req.body?.status);if(!status.success){res.status(400).json({error:"Shipping status is invalid."});return;}const [item]=await db.select().from(creatorHubOrderItemsTable).where(and(eq(creatorHubOrderItemsTable.id,Number(req.params.id)),eq(creatorHubOrderItemsTable.businessUserId,userId))).limit(1);if(!item){res.status(404).json({error:"Order item not found."});return;}const at=now();const [row]=await db.update(creatorHubOrderItemsTable).set({fulfillmentStatus:status.data,trackingNumber:typeof req.body?.trackingNumber==="string"?req.body.trackingNumber:null,shippedAt:status.data==="shipped"?at:item.shippedAt,deliveredAt:status.data==="delivered"?at:item.deliveredAt}).where(eq(creatorHubOrderItemsTable.id,item.id)).returning();const [order]=await db.select({status:creatorHubOrdersTable.status}).from(creatorHubOrdersTable).where(eq(creatorHubOrdersTable.id,item.orderId)).limit(1);if(order?.status==="paid"&&row?.creatorUserId&&(row.shippedAt||row.deliveredAt))await db.update(creatorHubPayoutsTable).set({status:"ready"}).where(and(eq(creatorHubPayoutsTable.orderItemId,item.id),eq(creatorHubPayoutsTable.status,"pending")));res.json(row);});
router.post("/creator-hub/order-items/:id/reviews", async(req,res)=>{const userId=await auth(req,res);if(userId===null)return;const p=z.object({rating:z.number().int().min(1).max(5),body:z.string().max(2000).default("")}).safeParse(req.body);if(!p.success){res.status(400).json({error:"Invalid review."});return;}const [item]=await db.select().from(creatorHubOrderItemsTable).innerJoin(creatorHubOrdersTable,eq(creatorHubOrdersTable.id,creatorHubOrderItemsTable.orderId)).where(and(eq(creatorHubOrderItemsTable.id,Number(req.params.id)),eq(creatorHubOrdersTable.buyerUserId,userId),eq(creatorHubOrdersTable.status,"paid"))).limit(1);if(!item){res.status(403).json({error:"A paid order is required to review."});return;}const [row]=await db.insert(creatorHubReviewsTable).values({orderItemId:item.creator_hub_order_items.id,productId:item.creator_hub_order_items.productId,buyerUserId:userId,rating:p.data.rating,body:p.data.body,createdAt:now()}).returning();res.status(201).json(row);});

export default router;