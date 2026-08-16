-- ORCALY_MARKETPLACE_STOCK_FK_INDEXES_1C2

create index if not exists marketplace_stock_reservations_order_idx
  on public.marketplace_stock_reservations (order_id);

create index if not exists marketplace_stock_reservations_product_idx
  on public.marketplace_stock_reservations (product_id);

create index if not exists product_stock_movements_payment_idx
  on public.product_stock_movements (marketplace_payment_id);

create index if not exists product_stock_movements_order_fk_idx
  on public.product_stock_movements (order_id);

create index if not exists product_stock_movements_product_idx
  on public.product_stock_movements (product_id);

create index if not exists product_stock_movements_reservation_idx
  on public.product_stock_movements (reservation_id);
