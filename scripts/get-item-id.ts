import { ItemService } from '../src/lib/db/items';

// Just quickly finding an item to test
const items = ItemService.getAll(5);
if (items.length > 0) {
  console.log("Use this ID to test the enrich endpoint:", items[0].id);
} else {
  console.log("No items found. Upload one first.");
}
