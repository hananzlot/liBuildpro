import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all rows from a Supabase query using pagination to avoid the 1000 row limit.
 * 
 * @param fetchPage - A function that takes (from, to) range and returns a page of data
 * @param pageSize - Number of rows per page (default 1000)
 * @returns Promise<T[]> - All rows combined
 * 
 * @example
 * ```typescript
 * const allOpportunities = await fetchAllPages<Opportunity>(async (from, to) => {
 *   const { data, error } = await supabase
 *     .from("opportunities")
 *     .select("*")
 *     .eq("company_id", companyId)
 *     .range(from, to);
 *   if (error) throw error;
 *   return data;
 * });
 * ```
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[] | null | undefined>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const page = await fetchPage(from, from + pageSize - 1);
    const items = page ?? [];
    all.push(...items);

    if (items.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

/**
 * Helper to build a paginated fetch function for simple table queries.
 * 
 * @param table - Table name
 * @param columns - Columns to select
 * @param filters - Object of column:value filters
 * @param orderBy - Column to order by (defaults to descending)
 * @param ascending - Order direction (default false = descending)
 */
export async function fetchAllFromTableWithFilters<T>(
  table: string,
  columns: string,
  filters: Record<string, unknown>,
  orderBy?: string,
  ascending = false
): Promise<T[]> {
  return fetchAllPages<T>(async (from, to) => {
    let query = supabase
      .from(table as any)
      .select(columns);
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value as any);
      }
    });
    
    // Apply ordering if specified
    if (orderBy) {
      query = query.order(orderBy as any, { ascending });
    }
    
    const { data, error } = await query.range(from, to);
    if (error) throw error;
    return data as T[];
  });
}
