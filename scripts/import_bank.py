#!/usr/bin/env python3
"""Validate and normalize the synthetic EPI bank into browser-ready JSON."""
import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def parse_quote(path):
    text = path.read_text(encoding="utf-8-sig")
    head = re.search(r"Cotización (Q-DEMO-\d+)", text)
    meta = re.search(r"Fecha (\d{4}-\d{2}-\d{2}), vigencia (\d+) días\. Proveedor ([\w-]+) \(([^)]+)\)\. SKU ([\w-]+) — (.+)\.", text)
    price = re.search(r"Cantidad ([\d.]+) ([^;]+); unitario USD ([\d.]+); snapshot FX ([\d.]+) ([A-Z]+/USD); local ([A-Z]+) ([\d.]+)\. Impuesto demo ([\d.]+)%: USD ([\d.]+); transporte USD ([\d.]+)\.", text)
    delivery = re.search(r"Entrega (\d+) días; pago (.+?); Incoterm (.+?); garantía (\d+) meses\.", text)
    if not all((head, meta, price, delivery)):
        raise ValueError("Could not parse quote: " + path.name)
    return {
        "quote_id": head.group(1), "date": meta.group(1), "validity_days": int(meta.group(2)),
        "vendor_id": meta.group(3), "country": meta.group(4), "sku": meta.group(5),
        "item_name": meta.group(6), "quantity": float(price.group(1)), "unit": price.group(2),
        "unit_price_usd": float(price.group(3)), "fx_local_per_usd_snapshot": float(price.group(4)),
        "currency": price.group(6), "unit_price_local_snapshot": float(price.group(7)),
        "tax_rate_demo": float(price.group(8)) / 100, "tax_usd_demo": float(price.group(9)),
        "shipping_usd_demo": float(price.group(10)), "delivery_days": int(delivery.group(1)),
        "payment_terms": delivery.group(2), "incoterm": delivery.group(3),
        "warranty_months": int(delivery.group(4)), "source": "quotes/" + path.name,
        "source_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "status": "DEMO_ONLY", "synthetic": True,
    }


def main():
    vendors = read_json(DATA / "catalogs/vendors.json")
    products = read_json(DATA / "catalogs/products_services.json")
    jurisdictions = read_json(DATA / "catalogs/jurisdictions.json")
    projects = read_json(DATA / "projects/demo_projects.json")
    quotes = [parse_quote(p) for p in sorted((DATA / "quotes").glob("Q-DEMO-*.md"))]
    vendor_ids = {v["vendor_id"] for v in vendors}
    skus = {p["sku"] for p in products}
    assert len(vendors) == 12 and len(products) == 40 and len(quotes) == 224
    assert len(projects) == 4 and len(jurisdictions) == 4
    assert len(skus) == 40 and len({q["quote_id"] for q in quotes}) == 224
    for q in quotes:
        assert q["vendor_id"] in vendor_ids and q["sku"] in skus
    (DATA / "quotes.json").write_text(json.dumps(quotes, ensure_ascii=False, indent=2), encoding="utf-8")
    result = {"vendors": len(vendors), "products": len(products), "quotes": len(quotes),
              "projects": len(projects), "jurisdictions": len(jurisdictions),
              "sku_ids": sorted(skus), "quote_first": quotes[0]["quote_id"], "quote_last": quotes[-1]["quote_id"]}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
