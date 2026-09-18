// Tipos das tabelas do CRM (espelham supabase/migrations/20260911120000_crm.sql).

export type OrderStatus = "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
export type PaymentStatus = "pending" | "paid" | "refused" | "refunded" | "chargeback";
export type CartStatus = "active" | "abandoned" | "recovered" | "manually_recovered" | "expired";
export type TrackingStatus = "label_created" | "shipped" | "in_transit" | "out_for_delivery" | "delivered" | "exception";
export type Channel = "email" | "whatsapp" | "sms";
export type AutomationType = "abandoned_cart" | "purchase_confirmation" | "promotion_reminder" | "tracking_notification" | "manual_followup";
export type AutomationStatus = "pending" | "processing" | "sent" | "delivered" | "failed" | "cancelled";

export type CustomerEventType =
  | "customer_created"
  | "contact_captured"
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_started"
  | "checkout_abandoned"
  | "purchase"
  | "payment_confirmed"
  | "payment_refused"
  | "refund"
  | "email_sent"
  | "email_delivered"
  | "email_opened"
  | "email_clicked"
  | "whatsapp_sent"
  | "whatsapp_delivered"
  | "whatsapp_read"
  | "manual_contact"
  | "tracking_added"
  | "tracking_sent"
  | "tracking_status_updated"
  | "order_shipped"
  | "order_delivered"
  | "cart_recovered";

export const CUSTOMER_EVENT_TYPES: CustomerEventType[] = [
  "customer_created", "contact_captured", "page_view", "product_view", "add_to_cart", "checkout_started",
  "checkout_abandoned", "purchase", "payment_confirmed", "payment_refused", "refund", "email_sent",
  "email_delivered", "email_opened", "email_clicked", "whatsapp_sent", "whatsapp_delivered", "whatsapp_read",
  "manual_contact", "tracking_added", "tracking_sent", "tracking_status_updated", "order_shipped",
  "order_delivered", "cart_recovered",
];

export interface CartItem {
  id?: string | null;
  name: string;
  quantity: number;
  price: number; // unitário, em unidades monetárias (não centavos)
  total: number;
  image?: string | null;
}

export interface ShippingAddress {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
}

export interface Customer {
  id: string;
  store_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  marketing_email_opt_in: boolean;
  marketing_whatsapp_opt_in: boolean;
  marketing_sms_opt_in: boolean;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerOverview extends Customer {
  abandoned_carts_count: number;
  recovered_carts_count: number;
}

export interface Cart {
  id: string;
  store_id: string;
  customer_id: string | null;
  session_id: string | null;
  external_cart_id: string | null;
  source: "site" | "checkout" | "manual";
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  items: CartItem[];
  product_summary: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  total: number;
  checkout_url: string | null;
  status: CartStatus;
  recovered_order_id: string | null;
  last_activity_at: string;
  abandoned_at: string | null;
  recovered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  store_id: string;
  customer_id: string | null;
  cart_id: string | null;
  external_order_id: string;
  provider: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  items: CartItem[];
  checkout_url: string | null;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_confirmed_at: string | null;
  shipping_address: ShippingAddress | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  tracking_carrier: string | null;
  tracking_status: TrackingStatus | null;
  tracking_status_updated_at: string | null;
  tracking_added_at: string | null;
  tracking_sent_at: string | null;
  tracking_notification_sent: boolean;
  shipped_at: string | null;
  estimated_delivery_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerEvent {
  id: string;
  store_id: string;
  customer_id: string | null;
  cart_id: string | null;
  order_id: string | null;
  session_id: string | null;
  event_type: CustomerEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AutomationEvent {
  id: string;
  store_id: string;
  customer_id: string | null;
  cart_id: string | null;
  order_id: string | null;
  channel: Channel;
  automation_type: AutomationType;
  status: AutomationStatus;
  dedupe_key: string;
  recipient: string | null;
  subject: string | null;
  provider: string | null;
  provider_message_id: string | null;
  attempts: number;
  scheduled_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StoreSettings {
  store_id: string;
  abandoned_cart_timeout_minutes: number;
  cart_expire_days: number;
  automation_dedupe_hours: number;
  promotion_active: boolean;
  promotion_start_at: string | null;
  promotion_end_at: string | null;
  promotion_message: string | null;
}

export interface WebhookEvent {
  id: string;
  store_id: string;
  provider: string;
  event_type: string | null;
  external_id: string | null;
  payload_hash: string;
  payload: Record<string, unknown>;
  status: "received" | "processed" | "ignored" | "error";
  error_message: string | null;
  order_id: string | null;
  received_at: string;
  processed_at: string | null;
}
