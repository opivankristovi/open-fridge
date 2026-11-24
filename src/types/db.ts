import type { CategoryKey } from '../domain/categories';
import type { LocationKind } from '../domain/locations';
import type { ShelfOverrides } from '../domain/shelfLife';

export type { CategoryKey, LocationKind };

export type StorageLocation = {
  id: string;
  household_id: string;
  /** null = show the translated label of the kind */
  name: string | null;
  kind: LocationKind;
  created_at: string;
  updated_at: string;
};

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type HouseholdMember = {
  household_id: string;
  user_id: string;
  display_name: string;
  role: 'owner' | 'member';
  joined_at: string;
};

export type ItemStatus = 'in_fridge' | 'consumed' | 'discarded';

export type Item = {
  id: string;
  household_id: string;
  added_by: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  photo_path: string | null;
  image_url: string | null;
  category: CategoryKey;
  quantity: number;
  added_at: string;
  /** null only for history rows whose location was deleted */
  location_id: string | null;
  /** when the item entered its current location (= added_at if never moved) */
  stored_at: string;
  /** 'YYYY-MM-DD' */
  expiry_date: string | null;
  opened_at: string | null;
  opened_shelf_days: number | null;
  fresh_shelf_days: number | null;
  status: ItemStatus;
  removed_at: string | null;
  removed_by: string | null;
  updated_at: string;
};

export type HouseholdProduct = {
  household_id: string;
  barcode: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  category: CategoryKey;
  last_opened_shelf_days: number | null;
  updated_at: string;
};

export type HouseholdSettings = {
  household_id: string;
  shelf_defaults: ShelfOverrides;
};

/** Result of the membership read with joined household. */
export type MyMembership = {
  household_id: string;
  display_name: string;
  role: 'owner' | 'member';
  households: { id: string; name: string; invite_code: string } | null;
};
