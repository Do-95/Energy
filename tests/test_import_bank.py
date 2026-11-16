import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("import_bank", ROOT / "scripts" / "import_bank.py")
import_bank = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(import_bank)


class BankImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vendors = json.loads((ROOT / "data/catalogs/vendors.json").read_text(encoding="utf-8"))
        cls.products = json.loads((ROOT / "data/catalogs/products_services.json").read_text(encoding="utf-8"))
        cls.jurisdictions = json.loads((ROOT / "data/catalogs/jurisdictions.json").read_text(encoding="utf-8"))
        cls.projects = json.loads((ROOT / "data/projects/demo_projects.json").read_text(encoding="utf-8"))
        cls.quotes = [import_bank.parse_quote(path) for path in sorted((ROOT / "data/quotes").glob("Q-DEMO-*.md"))]

    def test_expected_record_counts_and_ids(self):
        self.assertEqual((12, 40, 224, 4, 4), (len(self.vendors), len(self.products), len(self.quotes), len(self.projects), len(self.jurisdictions)))
        self.assertEqual("EPI-001", self.products[0]["sku"])
        self.assertEqual("EPI-040", self.products[-1]["sku"])
        self.assertEqual("Q-DEMO-0001", self.quotes[0]["quote_id"])
        self.assertEqual("Q-DEMO-0224", self.quotes[-1]["quote_id"])

    def test_quote_references_are_valid(self):
        vendor_ids = {v["vendor_id"] for v in self.vendors}
        skus = {p["sku"] for p in self.products}
        for quote in self.quotes:
            self.assertIn(quote["vendor_id"], vendor_ids)
            self.assertIn(quote["sku"], skus)
            self.assertTrue((ROOT / "data" / quote["source"]).is_file())
            self.assertTrue(quote["synthetic"])

    def test_demo_projects_have_required_categories(self):
        self.assertEqual({"DEMO-P01", "DEMO-P02", "DEMO-P03", "DEMO-P04"}, {p["project_id"] for p in self.projects})
        for project in self.projects:
            self.assertTrue(project["required_categories"])
            self.assertIn(project["jurisdiction_code"], {j["jurisdiction_code"] for j in self.jurisdictions})


if __name__ == "__main__":
    unittest.main(verbosity=2)
