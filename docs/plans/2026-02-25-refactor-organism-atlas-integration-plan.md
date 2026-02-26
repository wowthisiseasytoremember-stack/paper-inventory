# Roadmap: Integrating `organism-atlas` Architectural Patterns

## System Architecture & Goal

The objective is to refactor `paper-inventory` to be more robust, maintainable, and responsive by adopting three core patterns from `organism-atlas`:

1.  **Centralized State Management:** Replace prop-drilling and local state with a global Zustand store.
2.  **Efficient Server State:** Replace manual `useEffect` polling with TanStack Query for data fetching and caching.
3.  **Enhanced Detail View:** Evolve the item detail page into a more fluid, tabbed modal view.

### Components to Be Created/Modified:

-   **New:**
    -   `src/store/itemStore.ts` (Zustand store)
    -   `src/hooks/useItems.ts` (Custom hook for TanStack Query)
    -   `src/components/ItemDetailModal.tsx`
    -   `src/components/StatusBadge.tsx`
-   **Modified:**
    -   `src/app/layout.tsx` (to add QueryClientProvider)
    -   `src/app/page.tsx` (to use the new store and hook)
    -   `src/components/ItemCard.tsx` (to trigger the modal)
    -   `src/app/items/[id]/page.tsx` (becomes the content for the modal)

### Dependency & Data Flow:

1.  **Zustand Store (`itemStore.ts`)** will be the foundational layer, holding the client-side state of all items.
2.  **TanStack Query (`useItems.ts`)** will depend on the Zustand store to update the global state with fresh data from the server.
3.  The main **Dashboard (`page.tsx`)** will depend on `useItems` and the Zustand store, removing its own local state management.
4.  The **Detail Modal (`ItemDetailModal.tsx`)** will be triggered from the dashboard and will fetch its detailed data using a separate TanStack Query hook.

---

## Milestones & Granular Tasks

### Milestone 1: Establish Global State with Zustand (Est: 2 Hours)

*Validate: The application still renders items, but the `items` array is now sourced from a global store instead of local state in `page.tsx`.*

-   **Task 1.1 (45 mins):**
    -   **Action:** Create `src/store/itemStore.ts`.
    -   **Details:** Define the store's interface (`ItemStore`) to hold `items: ResearchItem[]`, `status: 'loading' | 'success' | 'error'`, and `error: string | null`. Implement the basic store structure.
-   **Task 1.2 (30 mins):**
    -   **Action:** Implement actions within `itemStore.ts`: `setItems`, `addItem`, `updateItemStatus`, `setError`.
-   **Task 1.3 (45 mins):**
    -   **Action:** Refactor `src/app/page.tsx`.
    -   **Details:** Remove the local `useState<Item[]>([])` for items. Instead, pull the items from the store using `const items = useItemStore(state => state.items);`. Replace direct `setItems` calls with the store's actions.

---

### Milestone 2: Refactor Data Fetching with TanStack Query (Est: 2.5 Hours)

*Validate: The dashboard automatically polls for data, and loading/error states are handled gracefully by TanStack Query. The manual `setInterval` is removed.*

-   **Task 2.1 (30 mins):**
    -   **Action:** Add `@tanstack/react-query` to `package.json`.
    -   **Action:** Modify `src/app/layout.tsx` to wrap the application in a `<QueryClientProvider>`.
-   **Task 2.2 (60 mins):**
    -   **Action:** Create a custom hook `src/hooks/useItems.ts`.
    -   **Details:** Inside this hook, use `useQuery` to fetch `/api/items`. Configure it with `refetchInterval` to handle the polling (e.g., 3000ms if processing, otherwise 20000ms).
    -   On success (`onSuccess` callback), call the `itemStore.ts` action `setItems(data)` to sync the server state with our global client state.
-   **Task 2.3 (60 mins):**
    -   **Action:** Refactor the main dashboard page (`src/app/page.tsx`).
    -   **Details:** Remove the manual `fetchItems` function and the `useEffect` that calls it. Instead, simply call `const { isLoading, error } = useItems();` at the top of the component to trigger the data fetching. Use the `isLoading` and `error` variables to render skeletons or error messages.

---

### Milestone 3: Implement the Item Detail Modal (Est: 3 Hours)

*Validate: Clicking an `ItemCard` now opens a modal with the item's details instead of navigating to a new page. The URL should update to reflect the open item.*

-   **Task 3.1 (90 mins):**
    -   **Action:** Create `src/components/ItemDetailModal.tsx`.
    -   **Details:**
        -   Use ShadCN's `Dialog` component as the base.
        -   Copy the layout and content from the existing `src/app/items/[id]/page.tsx` to serve as the modal's body.
        -   Create a new `useItemDetail(itemId)` TanStack Query hook to fetch the specific data for the modal.
-   **Task 3.2 (60 mins):**
    -   **Action:** Modify `src/app/page.tsx` to manage the modal's state.
    -   **Details:** Use a local state `const [selectedItemId, setSelectedItemId] = useState<string | null>(null);`. Pass `selectedItemId` and the setter to the `<ItemDetailModal>`.
-   **Task 3.3 (30 mins):**
    -   **Action:** Update `src/components/ItemCard.tsx`.
    -   **Details:** Change the `onClick` handler. Instead of a Next.js `<Link>`, it should now call a function passed via props that sets the `selectedItemId` in the parent dashboard page, which will trigger the modal.

---

### Milestone 4: Polish & Finalize Integration (Est: 1.5 Hours)

*Validate: The application is fully functional with the new architecture, and old/redundant code is removed.*

-   **Task 4.1 (45 mins):**
    -   **Action:** Implement a tabbed interface within `ItemDetailModal.tsx`.
    -   **Details:** Use ShadCN's `Tabs` component to organize the modal's content into "AI Analysis", "Research Context", and "OCR Text" sections. This improves usability.
-   **Task 4.2 (45 mins):**
    -   **Action:** Cleanup and code removal.
    -   **Details:** Delete the now-redundant `src/app/items/[id]/page.tsx` file (or keep it as a fallback for non-JS users). Remove any old state management logic from `page.tsx` that is now handled by Zustand and TanStack Query.

---

## Risk Assessment

-   **High Priority:**
    -   **State Reconciliation:** Ensuring that the data from TanStack Query correctly and efficiently updates the Zustand store without causing unnecessary re-renders will be critical. The `onSuccess` callback must be implemented carefully.
-   **Medium Priority:**
    -   **Modal vs. Page:** The move from a dedicated detail page to a modal might affect SEO or deep-linking. We will need to decide if we want to use query parameters in the URL to maintain linkability for open modals.
    -   **Component Refactoring:** The existing detail page may have dependencies that are not easily transferable to a modal context. This will require careful refactoring.
