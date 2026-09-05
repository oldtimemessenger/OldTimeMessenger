import { randomUUID } from "node:crypto";

type FirebaseProfile = {
  uid: string;
  email: string;
  name?: string;
  username?: string;
};

function supabaseConfiguration(): { url: string; serviceRoleKey: string } {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase profile synchronization is not configured.");
  }
  return { url, serviceRoleKey };
}

function headers(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
}

export async function syncFirebaseProfile(profile: FirebaseProfile): Promise<void> {
  const { url, serviceRoleKey } = supabaseConfiguration();
  const filter = encodeURIComponent(profile.uid);
  const lookup = await fetch(
    `${url}/rest/v1/profiles?select=id&firebase_uid=eq.${filter}&limit=1`,
    { headers: headers(serviceRoleKey) },
  );
  if (!lookup.ok) {
    throw new Error(`Supabase profile lookup failed with status ${lookup.status}.`);
  }

  const matches = (await lookup.json()) as Array<{ id: string }>;
  const now = new Date().toISOString();
  const identityFields = {
    email: profile.email,
    updated_at: now,
    ...(profile.name?.trim() ? { display_name: profile.name.trim().slice(0, 80) } : {}),
    ...(profile.username?.trim() ? { username: profile.username.trim().toLowerCase().slice(0, 24) } : {}),
  };
  if (matches[0]) {
    const update = await fetch(
      `${url}/rest/v1/profiles?firebase_uid=eq.${filter}`,
      {
        method: "PATCH",
        headers: headers(serviceRoleKey),
        body: JSON.stringify(identityFields),
      },
    );
    if (!update.ok) {
      throw new Error(`Supabase profile update failed with status ${update.status}.`);
    }
    return;
  }

  const create = await fetch(`${url}/rest/v1/profiles`, {
    method: "POST",
    headers: headers(serviceRoleKey),
    body: JSON.stringify({
      id: randomUUID(),
      firebase_uid: profile.uid,
      ...identityFields,
      phone: null,
      phone_hash: null,
      created_at: now,
    }),
  });
  if (!create.ok) {
    throw new Error(`Supabase profile creation failed with status ${create.status}.`);
  }
}
export async function deleteSupabaseProfileByFirebaseUid(uid: string): Promise<void> {
  if (!uid.trim()) {
    throw new Error("Firebase user ID is required.");
  }
  const { url, serviceRoleKey } = supabaseConfiguration();
  const filter = encodeURIComponent(uid);
  const deletion = await fetch(
    `${url}/rest/v1/profiles?firebase_uid=eq.${filter}`,
    {
      method: "DELETE",
      headers: {
        ...headers(serviceRoleKey),
        prefer: "return=minimal",
      },
    },
  );
  if (!deletion.ok) {
    throw new Error(`Supabase profile deletion failed with status ${deletion.status}.`);
  }
}
