"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requirePermission } from "@/lib/utils/permissions";
import type { ActionResult } from "./auth.actions";
import type { InventoryCategory, InventoryTxnType } from "@/types/database";

export interface CreateInventoryItemInput {
  name: string;
  category: InventoryCategory;
  barcode?: string;
  initialQuantity: number;
  unit: string;
  costPrice?: number;
  sellPrice?: number;
  lowStockThreshold: number;
  expiryDate?: string;
  supplier?: string;
  notes?: string;
}

export async function createInventoryItem(input: CreateInventoryItemInput): Promise<ActionResult<{ itemId: string }>> {
  try {
    await requirePermission("inventory", "create");
  } catch {
    return { success: false, error: "You do not have permission to add inventory." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("inventory_items")
    .insert({
      gym_id: actor.gym_id,
      name: input.name,
      category: input.category,
      barcode: input.barcode || null,
      quantity: 0,
      unit: input.unit,
      cost_price: input.costPrice ?? null,
      sell_price: input.sellPrice ?? null,
      low_stock_threshold: input.lowStockThreshold,
      expiry_date: input.expiryDate || null,
      supplier: input.supplier || null,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error || !item) return { success: false, error: "Could not add this item." };

  if (input.initialQuantity > 0) {
    await supabase.from("inventory_transactions").insert({
      item_id: item.id,
      gym_id: actor.gym_id,
      type: "restock",
      quantity_change: input.initialQuantity,
      notes: "Initial stock",
      created_by: actor.id,
    });
  }

  revalidatePath("/dashboard/owner/inventory");
  revalidatePath("/dashboard/reception/inventory");
  return { success: true, data: { itemId: item.id } };
}

export async function adjustStock(itemId: string, type: InventoryTxnType, quantityChange: number, notes?: string): Promise<ActionResult> {
  try {
    await requirePermission("inventory", "update");
  } catch {
    return { success: false, error: "You do not have permission to adjust stock." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const signedChange = type === "restock" ? Math.abs(quantityChange) : -Math.abs(quantityChange);

  const { error } = await supabase.from("inventory_transactions").insert({
    item_id: itemId,
    gym_id: actor.gym_id,
    type,
    quantity_change: type === "adjustment" ? quantityChange : signedChange,
    notes: notes || null,
    created_by: actor.id,
  });
  if (error) return { success: false, error: "Could not record this stock change." };

  revalidatePath("/dashboard/owner/inventory");
  revalidatePath("/dashboard/reception/inventory");
  return { success: true };
}

export async function deleteInventoryItem(itemId: string): Promise<ActionResult> {
  try {
    await requirePermission("inventory", "delete");
  } catch {
    return { success: false, error: "You do not have permission to remove inventory." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").update({ is_active: false }).eq("id", itemId);
  if (error) return { success: false, error: "Could not remove this item." };
  revalidatePath("/dashboard/owner/inventory");
  return { success: true };
}

export interface ListInventoryParams {
  search?: string;
  category?: string;
  lowStockOnly?: boolean;
}

export async function listInventory(params: ListInventoryParams) {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];

  const supabase = await createClient();
  let query = supabase.from("inventory_overview").select("*").eq("gym_id", actor.gym_id);

  if (params.search) query = query.ilike("name", `%${params.search}%`);
  if (params.category && params.category !== "all") query = query.eq("category", params.category);
  if (params.lowStockOnly) query = query.eq("is_low_stock", true);

  const { data } = await query.order("name");
  return data ?? [];
}

export async function getInventoryStats() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { totalItems: 0, lowStock: 0, expiringSoon: 0 };

  const supabase = await createClient();
  const { data } = await supabase.from("inventory_overview").select("is_low_stock, is_expiring_soon").eq("gym_id", actor.gym_id);

  return {
    totalItems: data?.length ?? 0,
    lowStock: data?.filter((d) => d.is_low_stock).length ?? 0,
    expiringSoon: data?.filter((d) => d.is_expiring_soon).length ?? 0,
  };
}
