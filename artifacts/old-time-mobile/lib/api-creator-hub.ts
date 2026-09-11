import { API_BASE_URL, API_CONFIGURED } from './api';

export type CreatorHubProfile = {
  userId: number;
  role: 'creator' | 'business';
  verificationState: string;
  displayName: string;
  bio: string;
  createdAt: number;
  updatedAt: number;
};

export type CreatorApplication = {
  id: number;
  userId: number;
  status: 'pending' | 'approved' | 'rejected';
  portfolioUrl: string | null;
  notes: string;
  reviewedBy: number | null;
  reviewedAt: number | null;
  createdAt: number;
};

export type BusinessVerification = {
  id: number;
  userId: number;
  status: 'pending' | 'approved' | 'rejected';
  legalName: string;
  taxIdLast4: string | null;
  documentObjectPaths: string[];
  reviewedBy: number | null;
  reviewedAt: number | null;
  createdAt: number;
};

export type CreatorHubProduct = {
  id: number;
  businessUserId: number;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  inventory: number;
  active: boolean;
  imageObjectPaths: string[];
  createdAt: number;
  updatedAt: number;
};

export type ProductWithReviews = CreatorHubProduct & {
  reviews: { average: number | null; count: number; items: any[] };
};

export type CreatorHubCampaign = {
  id: number;
  productId: number;
  businessUserId: number;
  name: string;
  description: string;
  commissionBps: number;
  status: 'draft' | 'active';
  startsAt: number | null;
  endsAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type CreatorProductApproval = {
  id: number;
  productId: number;
  campaignId: number | null;
  creatorUserId: number;
  status: 'pending' | 'approved' | 'declined';
  referralSlug: string | null;
  commissionBps: number;
  reviewedAt: number | null;
  createdAt: number;
};

export type CreatorHubCart = {
  id: number;
  userId: number;
  status: 'open' | 'checked_out';
  createdAt: number;
  updatedAt: number;
};

export type CreatorHubCartItem = {
  id: number;
  cartId: number;
  productId: number;
  quantity: number;
  referralSlug: string | null;
  creatorUserId: number | null;
  createdAt: number;
  product: CreatorHubProduct | null;
  lineTotalCents: number;
};

export type CartWithItems = CreatorHubCart & {
  items: CreatorHubCartItem[];
};

export type CreatorHubOrder = {
  id: number;
  buyerUserId: number;
  status: string;
  totalCents: number;
  currency: string;
  idempotencyKey: string;
  paymentIntentId: string | null;
  shippingAddress: Record<string, string> | null;
  createdAt: number;
  updatedAt: number;
};

export type CreatorHubOrderItem = {
  id: number;
  orderId: number;
  productId: number;
  businessUserId: number;
  creatorUserId: number | null;
  referralSlug: string | null;
  quantity: number;
  unitPriceCents: number;
  commissionBps: number;
  commissionCents: number;
  fulfillmentStatus: 'unfulfilled' | 'shipped' | 'delivered';
  trackingNumber: string | null;
  shippedAt: number | null;
  deliveredAt: number | null;
};

export type OrderWithItems = CreatorHubOrder & {
  items: CreatorHubOrderItem[];
};

export type DashboardStats = {
  role: 'creator' | 'business' | null;
  products: number;
  campaigns: number;
  approvals: number;
  orders: number;
  affiliateClicks: number;
  totalCents: number;
  commissionCents: number;
};

async function chFetch<T>(path: string, getToken: () => Promise<string | null>, init?: RequestInit): Promise<T> {
  if (!API_CONFIGURED) throw new Error('API is not configured.');
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    let message = 'CreatorHub request failed.';
    try {
      const payload = await response.json();
      if (payload.error) message = payload.error;
      else if (payload.message) message = payload.message;
    } catch {}
    throw new Error(message);
  }
  return response.status !== 204 ? response.json() : (undefined as T);
}

export const CreatorHubApi = {
  getMe: (getToken: () => Promise<string | null>) =>
    chFetch<{ profile: CreatorHubProfile | null; creatorApplication: CreatorApplication | null; businessVerification: BusinessVerification | null; isSystemAdmin: boolean }>('/api/creator-hub/me', getToken),
  
  applyCreator: (getToken: () => Promise<string | null>, data: { portfolioUrl?: string | null; notes?: string }) =>
    chFetch<CreatorApplication>('/api/creator-hub/creator-applications', getToken, { method: 'POST', body: JSON.stringify(data) }),
  
  applyBusiness: (getToken: () => Promise<string | null>, data: { legalName: string; taxIdLast4?: string | null; documentObjectPaths?: string[] }) =>
    chFetch<BusinessVerification>('/api/creator-hub/business-verifications', getToken, { method: 'POST', body: JSON.stringify(data) }),
  
  getShopProducts: (getToken: () => Promise<string | null>) =>
    chFetch<CreatorHubProduct[]>('/api/creator-hub/shop/products', getToken),
  
  getProduct: (getToken: () => Promise<string | null>, id: number) =>
    chFetch<ProductWithReviews>(`/api/creator-hub/shop/products/${id}`, getToken),
  
  createBusinessProduct: (getToken: () => Promise<string | null>, data: { name: string; description?: string; priceCents: number; inventory?: number; slug: string; imageObjectPaths?: string[]; active?: boolean }) =>
    chFetch<CreatorHubProduct>('/api/creator-hub/business/products', getToken, { method: 'POST', body: JSON.stringify(data) }),
    
  updateBusinessProduct: (getToken: () => Promise<string | null>, id: number, data: Partial<{ name: string; description: string; priceCents: number; inventory: number; slug: string; imageObjectPaths: string[]; active: boolean }>) =>
    chFetch<CreatorHubProduct>(`/api/creator-hub/business/products/${id}`, getToken, { method: 'PATCH', body: JSON.stringify(data) }),
    
  deleteBusinessProduct: (getToken: () => Promise<string | null>, id: number) =>
    chFetch<void>(`/api/creator-hub/business/products/${id}`, getToken, { method: 'DELETE' }),
    
  getCampaigns: (getToken: () => Promise<string | null>) =>
    chFetch<CreatorHubCampaign[]>('/api/creator-hub/campaigns', getToken),
    
  createCampaign: (getToken: () => Promise<string | null>, data: { productId: number; name: string; description?: string; commissionBps: number; status?: 'draft' | 'active' }) =>
    chFetch<CreatorHubCampaign>('/api/creator-hub/business/campaigns', getToken, { method: 'POST', body: JSON.stringify(data) }),
    
  applyCampaign: (getToken: () => Promise<string | null>, campaignId: number) =>
    chFetch<CreatorProductApproval>(`/api/creator-hub/campaigns/${campaignId}/apply`, getToken, { method: 'POST' }),
    
  getBusinessApprovals: (getToken: () => Promise<string | null>) =>
    chFetch<CreatorProductApproval[]>('/api/creator-hub/business/approvals', getToken),
    
  reviewApproval: (getToken: () => Promise<string | null>, id: number, approved: boolean) =>
    chFetch<CreatorProductApproval>(`/api/creator-hub/business/approvals/${id}/review`, getToken, { method: 'POST', body: JSON.stringify({ approved }) }),
    
  recordAffiliateClick: (getToken: () => Promise<string | null>, data: { productId: number; referralSlug?: string | null }) =>
    chFetch<any>('/api/creator-hub/affiliate/clicks', getToken, { method: 'POST', body: JSON.stringify(data) }),
    
  getCart: (getToken: () => Promise<string | null>) =>
    chFetch<CartWithItems>('/api/creator-hub/cart', getToken),
    
  addCartItem: (getToken: () => Promise<string | null>, data: { productId: number; quantity: number; referralSlug?: string | null }) =>
    chFetch<CreatorHubCartItem>('/api/creator-hub/cart/items', getToken, { method: 'POST', body: JSON.stringify(data) }),
    
  updateCartItem: (getToken: () => Promise<string | null>, id: number, quantity: number) =>
    chFetch<CreatorHubCartItem>(`/api/creator-hub/cart/items/${id}`, getToken, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
    
  deleteCartItem: (getToken: () => Promise<string | null>, id: number) =>
    chFetch<void>(`/api/creator-hub/cart/items/${id}`, getToken, { method: 'DELETE' }),
    
  createOrder: (getToken: () => Promise<string | null>, idempotencyKey: string) =>
    chFetch<CreatorHubOrder>('/api/creator-hub/orders', getToken, { method: 'POST', headers: { 'idempotency-key': idempotencyKey } }),
    
  getOrders: (getToken: () => Promise<string | null>) =>
    chFetch<CreatorHubOrder[]>('/api/creator-hub/orders', getToken),
    
  getOrder: (getToken: () => Promise<string | null>, id: number) =>
    chFetch<OrderWithItems>(`/api/creator-hub/orders/${id}`, getToken),
    
  checkoutOrder: (getToken: () => Promise<string | null>, id: number) =>
    chFetch<{ order: CreatorHubOrder; clientSecret: string; publishableKey: string }>(`/api/creator-hub/orders/${id}/checkout-preparation`, getToken, { method: 'POST' }),
    
  getDashboard: (getToken: () => Promise<string | null>) =>
    chFetch<DashboardStats>('/api/creator-hub/dashboard', getToken),
    
  getBusinessOrders: (getToken: () => Promise<string | null>) =>
    chFetch<CreatorHubOrderItem[]>('/api/creator-hub/business/orders', getToken),
    
  getBusinessProducts: (getToken: () => Promise<string | null>) =>
    chFetch<CreatorHubProduct[]>('/api/creator-hub/business/products', getToken),
    
  getCreatorApprovals: (getToken: () => Promise<string | null>) =>
    chFetch<(CreatorProductApproval & { product: CreatorHubProduct })[]>('/api/creator-hub/creator/approvals', getToken),
    
  attachProductToPost: (getToken: () => Promise<string | null>, postId: number, productId: number) =>
    chFetch<any>(`/api/creator-hub/posts/${postId}/products`, getToken, { method: 'POST', body: JSON.stringify({ productId }) }),
    
  getAdminQueues: (getToken: () => Promise<string | null>) =>
    chFetch<{ creatorApplications: CreatorApplication[]; businessVerifications: BusinessVerification[] }>('/api/creator-hub/admin/queues', getToken),
    
  reviewCreatorApplication: (getToken: () => Promise<string | null>, id: number, approved: boolean) =>
    chFetch<CreatorApplication>(`/api/creator-hub/admin/creator-applications/${id}/review`, getToken, { method: 'POST', body: JSON.stringify({ approved }) }),
    
  reviewBusinessVerification: (getToken: () => Promise<string | null>, id: number, approved: boolean) =>
    chFetch<BusinessVerification>(`/api/creator-hub/admin/business-verifications/${id}/review`, getToken, { method: 'POST', body: JSON.stringify({ approved }) }),
    
  updateBusinessOrderItemShipping: (getToken: () => Promise<string | null>, id: number, status: 'shipped' | 'delivered', trackingNumber?: string | null) =>
    chFetch<CreatorHubOrderItem>(`/api/creator-hub/business/order-items/${id}/shipping`, getToken, { method: 'POST', body: JSON.stringify({ status, trackingNumber }) }),
    
  reviewOrderItem: (getToken: () => Promise<string | null>, id: number, data: { rating: number; body?: string }) =>
    chFetch<any>(`/api/creator-hub/order-items/${id}/reviews`, getToken, { method: 'POST', body: JSON.stringify(data) }),
};
