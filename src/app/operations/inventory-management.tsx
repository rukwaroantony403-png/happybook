"use client";

import { useState, type FormEvent } from "react";

type StockItem = Record<string, unknown>;
type StockMovement = Record<string, unknown>;
type SaveItem = (kind: string, record: StockItem) => Promise<StockItem | null>;

const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const money = (value: number) => `KSh ${new Intl.NumberFormat("en-KE").format(value || 0)}`;

export function InventoryManagement({ items, movements, suppliers, persistRecord, refresh, action }: {
  items: StockItem[];
  movements: StockMovement[];
  suppliers: StockItem[];
  persistRecord: SaveItem;
  refresh: () => Promise<void>;
  action: (message: string) => void;
}) {
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [movementItem, setMovementItem] = useState<StockItem | null>(null);
  const [movementType, setMovementType] = useState<"receive" | "issue" | "adjustment">("receive");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lowStock = items.filter((item) => Number(item.quantity) <= Number(item.reorderAt));
  const stockValue = items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitCostKsh || 0), 0);
  const categories = [...new Set(items.map((item) => String(item.category || "Uncategorized")))].sort((a, b) => a.localeCompare(b));
  const filteredItems = items.filter((item) =>
    (categoryFilter === "all" || String(item.category || "Uncategorized") === categoryFilter) &&
    (!lowStockOnly || Number(item.quantity) <= Number(item.reorderAt)),
  );

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const record: StockItem = {
      ...(editing || {}),
      name: String(form.get("name") || "").trim(),
      sku: String(form.get("sku") || "").trim(),
      category: String(form.get("category") || "").trim(),
      unit: String(form.get("unit") || "").trim(),
      quantity: Number(form.get("quantity")),
      reorderAt: Number(form.get("reorderAt")),
      unitCostKsh: Number(form.get("unitCostKsh")),
      supplier: String(form.get("supplier") || "").trim(),
      description: String(form.get("description") || "").trim(),
    };
    setSaving(true);
    try {
      const saved = await persistRecord("inventory", record);
      if (!saved) throw new Error("Inventory item could not be saved.");
      setEditing(null);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Inventory item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movementItem) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const enteredQuantity = Number(form.get("quantity"));
    const quantity = movementType === "issue" ? -Math.abs(enteredQuantity)
      : movementType === "receive" ? Math.abs(enteredQuantity) : enteredQuantity;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/inventory/${encodeURIComponent(String(movementItem.id))}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementType,
          quantity,
          reason: String(form.get("reason") || "").trim(),
          reference: String(form.get("reference") || "").trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Stock movement could not be saved.");
      setMovementItem(null);
      await refresh();
      action(`Stock ${movementType === "receive" ? "received" : movementType === "issue" ? "issued" : "adjusted"} successfully.`);
    } catch (movementError) {
      setError(movementError instanceof Error ? movementError.message : "Stock movement could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="inventory-workspace">
    <section className="inventory-summary" aria-label="Inventory summary">
      <article><span>Stock items</span><b>{items.length}</b><small>Tracked products and supplies</small></article>
      <article className={lowStock.length ? "inventory-summary-alert" : ""}><span>At or below reorder level</span><b>{lowStock.length}</b><small>Review these items and restock</small></article>
      <article><span>Stock value</span><b>{money(stockValue)}</b><small>Current quantity × unit cost</small></article>
    </section>

    {lowStock.length > 0 && <section className="inventory-low-stock" aria-live="polite"><b>Restock attention</b><span>{lowStock.map((item) => `${String(item.name)} (${Number(item.quantity)} ${String(item.unit || "units")} left)`).join(" · ")}</span></section>}

    <form className="room-setup-form inventory-item-form" onSubmit={(event) => void saveItem(event)}>
      <h2>{editing ? `Edit ${String(editing.name)}` : "Add an inventory item"}</h2>
      <p>{editing ? "Update item details. Use stock movements below to change the on-hand quantity." : "Create a stock record with an opening quantity, unit cost, supplier and reorder level."}</p>
      {error && !movementItem && <p className="room-form-message" role="alert">{error}</p>}
      <input type="hidden" name="id" value={String(editing?.id || "")}/>
      <div>
        <label>Item name<input name="name" required maxLength={200} defaultValue={String(editing?.name || "")} placeholder="e.g. Bath towels"/></label>
        <label>SKU / item code<input name="sku" maxLength={80} defaultValue={String(editing?.sku || "")} placeholder="Optional internal code"/></label>
        <label>Category<input name="category" required maxLength={100} defaultValue={String(editing?.category || "")} placeholder="e.g. Housekeeping"/></label>
        <label>Unit of measure<input name="unit" required maxLength={40} defaultValue={String(editing?.unit || "pieces")} placeholder="pieces, bottles, kg"/></label>
        <label>{editing ? "Current quantity (read-only)" : "Opening quantity"}<input name="quantity" type="number" min="0" max="1000000" step="1" required readOnly={Boolean(editing)} defaultValue={editing ? Number(editing.quantity) : 0}/></label>
        <label>Reorder level<input name="reorderAt" type="number" min="0" max="1000000" step="1" required defaultValue={Number(editing?.reorderAt || 0)}/></label>
        <label>Unit cost (KSh)<input name="unitCostKsh" type="number" min="0" max="100000000" step="1" required defaultValue={Number(editing?.unitCostKsh || 0)}/></label>
        <label>Supplier<select name="supplier" defaultValue={String(editing?.supplier || "")}><option value="">No supplier selected</option>{suppliers.map((supplier) => <option key={String(supplier.id || supplier.key)} value={String(supplier.name)}>{String(supplier.name)}</option>)}</select></label>
        <label className="inventory-wide-field">Description / storage note<textarea name="description" maxLength={500} rows={2} defaultValue={String(editing?.description || "")} placeholder="Optional item details or storage location"/></label>
        <div className="inventory-form-actions"><button className="primary-btn" disabled={saving}>{saving ? "Saving…" : editing ? "Save item details" : "Add item"}</button>{editing && <button type="button" className="outline-btn" disabled={saving} onClick={() => { setEditing(null); setError(""); }}>Cancel edit</button>}</div>
      </div>
    </form>

    <section className="module-card inventory-items-card">
      <div className="inventory-section-heading"><div><h2>Stock register</h2><p>Receive, issue, or reconcile quantities. Every stock change is recorded in the movement ledger.</p></div><div className="inventory-filter-actions"><label>Category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><button type="button" className={lowStockOnly ? "selected" : ""} aria-pressed={lowStockOnly} onClick={() => setLowStockOnly((current) => !current)}>Low stock{lowStock.length ? ` · ${lowStock.length}` : ""}</button></div></div>
      {items.length ? filteredItems.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{["ITEM / SKU", "CATEGORY", "ON HAND", "REORDER AT", "UNIT COST", "STOCK VALUE", "SUPPLIER", "STOCK STATUS", "ACTIONS"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{filteredItems.map((item) => {
        const quantity = Number(item.quantity || 0);
        const reorderAt = Number(item.reorderAt || 0);
        const isLow = quantity <= reorderAt;
        return <tr key={String(item.id || item.key)}>
          <td><b>{text(item.name)}</b><small>{text(item.sku)}</small></td>
          <td>{text(item.category)}</td>
          <td><b>{quantity} {text(item.unit || "units")}</b></td>
          <td>{reorderAt} {text(item.unit || "units")}</td>
          <td>{money(Number(item.unitCostKsh || 0))}</td>
          <td>{money(quantity * Number(item.unitCostKsh || 0))}</td>
          <td>{text(item.supplier)}</td>
          <td><span className={`inventory-status${isLow ? " low" : ""}`}>{isLow ? quantity === 0 ? "Out of stock" : "Reorder" : "In stock"}</span></td>
          <td><div className="inventory-row-actions">
            <button type="button" onClick={() => { setError(""); setMovementType("receive"); setMovementItem(item); }}>Receive</button>
            <button type="button" disabled={quantity === 0} onClick={() => { setError(""); setMovementType("issue"); setMovementItem(item); }}>Issue</button>
            <button type="button" onClick={() => { setError(""); setMovementType("adjustment"); setMovementItem(item); }}>Adjust</button>
            <button type="button" onClick={() => { setError(""); setEditing(item); }}>Edit</button>
          </div></td>
        </tr>;
      })}</tbody></table></div> : <div className="live-empty"><b>No items match these filters</b><p>Change the category or turn off the low-stock filter to see more stock.</p></div> : <div className="live-empty"><span className="empty-mark" aria-hidden="true"/><b>No stock items yet</b><p>Add your first item above to start tracking hotel supplies.</p></div>}
    </section>

    <section className="module-card inventory-movements-card">
      <div className="inventory-section-heading"><div><h2>Recent stock movements</h2><p>Latest {movements.length} movements. Opening quantities and legacy balances are included in the ledger.</p></div></div>
      {movements.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{["DATE", "ITEM", "MOVEMENT", "CHANGE", "BALANCE AFTER", "REASON", "REFERENCE", "RECORDED BY"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{movements.map((movement) => <tr key={String(movement.id)}><td>{text(movement.createdAt)}</td><td>{text(movement.itemName)}</td><td>{text(movement.movementType)}</td><td>{Number(movement.quantityDelta) > 0 ? "+" : ""}{Number(movement.quantityDelta)} {text(items.find((item) => String(item.id || item.key) === String(movement.itemKey))?.unit || "units")}</td><td>{Number(movement.quantityAfter)} {text(items.find((item) => String(item.id || item.key) === String(movement.itemKey))?.unit || "units")}</td><td>{text(movement.reason)}</td><td>{text(movement.reference)}</td><td>{text(movement.actor)}</td></tr>)}</tbody></table></div> : <div className="live-empty"><b>No stock movements yet</b><p>Opening balances and every receive, issue, or adjustment will appear here.</p></div>}
    </section>

    {movementItem && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setMovementItem(null); }}><section className="room-editor-modal inventory-movement-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-movement-title"><header className="room-editor-heading"><div><span className="module-crumb">STOCK CONTROL</span><h2 id="inventory-movement-title">{movementType === "receive" ? "Receive stock" : movementType === "issue" ? "Issue stock" : "Adjust stock"}</h2></div><button type="button" className="outline-btn" disabled={saving} onClick={() => setMovementItem(null)}>Close</button></header><p><b>{String(movementItem.name)}</b> · Current balance: {Number(movementItem.quantity)} {String(movementItem.unit || "units")}</p>{error && <p className="room-form-message" role="alert">{error}</p>}<form className="room-setup-form" onSubmit={(event) => void saveMovement(event)}><div>
      <label>{movementType === "adjustment" ? "Quantity change (+/-)" : "Quantity"}<input name="quantity" type="number" min={movementType === "adjustment" ? -1000000 : 1} max="1000000" step="1" required autoFocus placeholder={movementType === "adjustment" ? "Use a negative number to reduce stock" : "Enter units"} /></label>
      <label>Reason<input name="reason" required minLength={2} maxLength={500} placeholder={movementType === "receive" ? "e.g. Supplier delivery" : movementType === "issue" ? "e.g. Issued to housekeeping" : "e.g. Physical stock count"} /></label>
      <label>Document / reference<input name="reference" maxLength={120} placeholder="Optional delivery note or issue reference"/></label>
      <small>Balance after movement: {movementType === "receive" ? "increases" : movementType === "issue" ? "decreases" : "changes by the signed quantity entered"}. Stock cannot go below zero.</small>
      <div className="inventory-form-actions"><button className="primary-btn" disabled={saving}>{saving ? "Saving movement…" : "Save stock movement"}</button><button type="button" className="outline-btn" disabled={saving} onClick={() => setMovementItem(null)}>Cancel</button></div>
    </div></form></section></div>}
  </div>;
}
