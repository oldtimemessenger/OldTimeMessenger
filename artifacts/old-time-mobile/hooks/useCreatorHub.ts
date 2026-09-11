import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { CreatorHubApi } from '@/lib/api-creator-hub';

export const CH_KEYS = {
  all: ['creator-hub'] as const,
  me: () => [...CH_KEYS.all, 'me'] as const,
  shopProducts: () => [...CH_KEYS.all, 'shop', 'products'] as const,
  businessProducts: () => [...CH_KEYS.all, 'business', 'products'] as const,
  product: (id: number) => [...CH_KEYS.all, 'shop', 'products', id] as const,
  campaigns: () => [...CH_KEYS.all, 'campaigns'] as const,
  businessApprovals: () => [...CH_KEYS.all, 'business', 'approvals'] as const,
  cart: () => [...CH_KEYS.all, 'cart'] as const,
  orders: () => [...CH_KEYS.all, 'orders'] as const,
  order: (id: number) => [...CH_KEYS.all, 'orders', id] as const,
  dashboard: () => [...CH_KEYS.all, 'dashboard'] as const,
  businessOrders: () => [...CH_KEYS.all, 'business', 'orders'] as const,
  creatorApprovals: () => [...CH_KEYS.all, 'creator', 'approvals'] as const,
  adminQueues: () => [...CH_KEYS.all, 'admin', 'queues'] as const,
};

export function useCreatorHubMe() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.me(),
    queryFn: () => CreatorHubApi.getMe(getToken),
    enabled: isSignedIn,
  });
}

export function useShopProducts() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.shopProducts(),
    queryFn: () => CreatorHubApi.getShopProducts(getToken),
  });
}

export function useBusinessProducts() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.businessProducts(),
    queryFn: () => CreatorHubApi.getBusinessProducts(getToken),
    enabled: isSignedIn,
    staleTime: 15_000,
  });
}

export function useShopProduct(id: number) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.product(id),
    queryFn: () => CreatorHubApi.getProduct(getToken, id),
    enabled: !!id,
  });
}

export function useCart() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.cart(),
    queryFn: () => CreatorHubApi.getCart(getToken),
    enabled: isSignedIn,
  });
}

export function useOrders() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.orders(),
    queryFn: () => CreatorHubApi.getOrders(getToken),
    enabled: isSignedIn,
  });
}

export function useOrder(id: number) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.order(id),
    queryFn: () => CreatorHubApi.getOrder(getToken, id),
    enabled: !!id && isSignedIn,
  });
}

export function useDashboard() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.dashboard(),
    queryFn: () => CreatorHubApi.getDashboard(getToken),
    enabled: isSignedIn,
  });
}

export function useCampaigns() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.campaigns(),
    queryFn: () => CreatorHubApi.getCampaigns(getToken),
    enabled: isSignedIn,
  });
}

export function useBusinessApprovals() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.businessApprovals(),
    queryFn: () => CreatorHubApi.getBusinessApprovals(getToken),
    enabled: isSignedIn,
  });
}

export function useBusinessOrders() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.businessOrders(),
    queryFn: () => CreatorHubApi.getBusinessOrders(getToken),
    enabled: isSignedIn,
  });
}

export function useCreatorApprovals() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.creatorApprovals(),
    queryFn: () => CreatorHubApi.getCreatorApprovals(getToken),
    enabled: isSignedIn,
  });
}

export function useAdminQueues() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: CH_KEYS.adminQueues(),
    queryFn: () => CreatorHubApi.getAdminQueues(getToken),
    enabled: isSignedIn,
  });
}
