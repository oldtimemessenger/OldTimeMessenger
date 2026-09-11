import { bigint as pgBigint, boolean, integer, index, jsonb, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const ts = () => pgBigint("created_at", { mode: "number" }).notNull();

export const creatorHubProfilesTable = pgTable("creator_hub_profiles", {
  userId: integer("user_id").primaryKey(),
  role: text("role").notNull().default("creator"),
  verificationState: text("verification_state").notNull().default("unverified"),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  createdAt: ts(),
  updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
});
export const creatorApplicationsTable = pgTable("creator_applications", {
  id: serial("id").primaryKey(), userId: integer("user_id").notNull(), status: text("status").notNull().default("pending"),
  portfolioUrl: text("portfolio_url"), notes: text("notes").notNull().default(""), reviewedBy: integer("reviewed_by"), reviewedAt: pgBigint("reviewed_at", { mode: "number" }), createdAt: ts(),
}, t => ({ userStatus: index("creator_applications_user_status_idx").on(t.userId, t.status), pending: uniqueIndex("creator_applications_pending_idx").on(t.userId).where(sql`${t.status} = 'pending'`) }));
export const businessVerificationsTable = pgTable("business_verifications", {
  id: serial("id").primaryKey(), userId: integer("user_id").notNull(), status: text("status").notNull().default("pending"), legalName: text("legal_name").notNull(), taxIdLast4: text("tax_id_last4"), documentObjectPaths: jsonb("document_object_paths").$type<string[]>().notNull().default([]), reviewedBy: integer("reviewed_by"), reviewedAt: pgBigint("reviewed_at", { mode: "number" }), createdAt: ts(),
}, t => ({ userStatus: index("business_verifications_user_status_idx").on(t.userId, t.status) }));
export const creatorHubProductsTable = pgTable("creator_hub_products", {
  id: serial("id").primaryKey(), businessUserId: integer("business_user_id").notNull(), slug: text("slug").notNull(), name: text("name").notNull(), description: text("description").notNull().default(""), priceCents: integer("price_cents").notNull(), currency: text("currency").notNull().default("usd"), inventory: integer("inventory").notNull().default(0), active: boolean("active").notNull().default(true), imageObjectPaths: jsonb("image_object_paths").$type<string[]>().notNull().default([]), createdAt: ts(), updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
}, t => ({ slug: uniqueIndex("creator_hub_products_slug_idx").on(t.slug), owner: index("creator_hub_products_owner_idx").on(t.businessUserId, t.active) }));
export const creatorHubCampaignsTable = pgTable("creator_hub_campaigns", {
  id: serial("id").primaryKey(), productId: integer("product_id").notNull(), businessUserId: integer("business_user_id").notNull(), name: text("name").notNull(), description: text("description").notNull().default(""), commissionBps: integer("commission_bps").notNull().default(1000), status: text("status").notNull().default("draft"), startsAt: pgBigint("starts_at", { mode: "number" }), endsAt: pgBigint("ends_at", { mode: "number" }), createdAt: ts(), updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
}, t => ({ owner: index("creator_hub_campaigns_owner_idx").on(t.businessUserId, t.status), product: index("creator_hub_campaigns_product_idx").on(t.productId) }));
export const creatorProductApprovalsTable = pgTable("creator_product_approvals", {
  id: serial("id").primaryKey(), productId: integer("product_id").notNull(), campaignId: integer("campaign_id"), creatorUserId: integer("creator_user_id").notNull(), status: text("status").notNull().default("pending"), referralSlug: text("referral_slug"), commissionBps: integer("commission_bps").notNull().default(1000), reviewedAt: pgBigint("reviewed_at", { mode: "number" }), createdAt: ts(),
}, t => ({ uniqueApproval: uniqueIndex("creator_product_approvals_unique_idx").on(t.productId, t.campaignId, t.creatorUserId), referral: uniqueIndex("creator_product_approvals_referral_idx").on(t.referralSlug), creator: index("creator_product_approvals_creator_idx").on(t.creatorUserId, t.status) }));
export const postProductAttachmentsTable = pgTable("post_product_attachments", {
  id: serial("id").primaryKey(), postId: integer("post_id").notNull(), productId: integer("product_id").notNull(), creatorUserId: integer("creator_user_id").notNull(), createdAt: ts(),
}, t => ({ uniqueAttachment: uniqueIndex("post_product_attachments_unique_idx").on(t.postId, t.productId), post: index("post_product_attachments_post_idx").on(t.postId) }));
export const affiliateClicksTable = pgTable("affiliate_clicks", {
  id: serial("id").primaryKey(), productId: integer("product_id").notNull(), creatorUserId: integer("creator_user_id"), referralSlug: text("referral_slug"), visitorHash: text("visitor_hash"), createdAt: ts(),
}, t => ({ productCreated: index("affiliate_clicks_product_created_idx").on(t.productId, t.createdAt), referral: index("affiliate_clicks_referral_idx").on(t.referralSlug) }));
export const creatorHubCartsTable = pgTable("creator_hub_carts", {
  id: serial("id").primaryKey(), userId: integer("user_id").notNull(), status: text("status").notNull().default("open"), createdAt: ts(), updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
}, t => ({ openCart: uniqueIndex("creator_hub_carts_user_open_idx").on(t.userId).where(sql`${t.status} = 'open'`) }));
export const creatorHubCartItemsTable = pgTable("creator_hub_cart_items", {
  id: serial("id").primaryKey(), cartId: integer("cart_id").notNull(), productId: integer("product_id").notNull(), quantity: integer("quantity").notNull(), referralSlug: text("referral_slug"), creatorUserId: integer("creator_user_id"), createdAt: ts(),
}, t => ({ uniqueItem: uniqueIndex("creator_hub_cart_items_unique_idx").on(t.cartId, t.productId) }));
export const creatorHubOrdersTable = pgTable("creator_hub_orders", {
  id: serial("id").primaryKey(), buyerUserId: integer("buyer_user_id").notNull(), status: text("status").notNull().default("pending"), totalCents: integer("total_cents").notNull(), currency: text("currency").notNull().default("usd"), idempotencyKey: text("idempotency_key").notNull(), paymentIntentId: text("payment_intent_id"), shippingAddress: jsonb("shipping_address").$type<Record<string, string>>(), createdAt: ts(), updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
}, t => ({ idempotency: uniqueIndex("creator_hub_orders_idempotency_idx").on(t.buyerUserId, t.idempotencyKey), buyer: index("creator_hub_orders_buyer_idx").on(t.buyerUserId, t.createdAt), payment: uniqueIndex("creator_hub_orders_payment_idx").on(t.paymentIntentId) }));
export const creatorHubOrderItemsTable = pgTable("creator_hub_order_items", {
  id: serial("id").primaryKey(), orderId: integer("order_id").notNull(), productId: integer("product_id").notNull(), businessUserId: integer("business_user_id").notNull(), creatorUserId: integer("creator_user_id"), referralSlug: text("referral_slug"), quantity: integer("quantity").notNull(), unitPriceCents: integer("unit_price_cents").notNull(), commissionBps: integer("commission_bps").notNull(), commissionCents: integer("commission_cents").notNull(), fulfillmentStatus: text("fulfillment_status").notNull().default("unfulfilled"), trackingNumber: text("tracking_number"), shippedAt: pgBigint("shipped_at", { mode: "number" }), deliveredAt: pgBigint("delivered_at", { mode: "number" }),
}, t => ({ order: index("creator_hub_order_items_order_idx").on(t.orderId), creator: index("creator_hub_order_items_creator_idx").on(t.creatorUserId, t.fulfillmentStatus) }));
export const creatorHubReviewsTable = pgTable("creator_hub_reviews", {
  id: serial("id").primaryKey(), orderItemId: integer("order_item_id").notNull(), productId: integer("product_id").notNull(), buyerUserId: integer("buyer_user_id").notNull(), rating: integer("rating").notNull(), body: text("body").notNull().default(""), createdAt: ts(),
}, t => ({ itemUnique: uniqueIndex("creator_hub_reviews_item_idx").on(t.orderItemId), product: index("creator_hub_reviews_product_idx").on(t.productId) }));
export const creatorHubPayoutsTable = pgTable("creator_hub_payouts", {
  id: serial("id").primaryKey(), orderItemId: integer("order_item_id").notNull(), creatorUserId: integer("creator_user_id").notNull(), amountCents: integer("amount_cents").notNull(), status: text("status").notNull().default("pending"), paidAt: pgBigint("paid_at", { mode: "number" }), createdAt: ts(),
}, t => ({ itemUnique: uniqueIndex("creator_hub_payouts_item_idx").on(t.orderItemId), creatorStatus: index("creator_hub_payouts_creator_status_idx").on(t.creatorUserId, t.status) }));