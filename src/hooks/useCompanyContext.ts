import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to get the current user's company context for database operations.
 * Use this when inserting or upserting records to include company_id.
 * 
 * @example
 * const { companyId, withCompanyId } = useCompanyContext();
 * 
 * // Option 1: Add company_id manually
 * await supabase.from("projects").insert({ ...data, company_id: companyId });
 * 
 * // Option 2: Use helper function
 * await supabase.from("projects").insert(withCompanyId({ ...data }));
 */
export function useCompanyContext() {
  const { companyId, corporationId, company, corporation, isCorpAdmin } = useAuth();

  /**
   * Adds company_id to an object for database inserts.
   * Returns the object with company_id added.
   */
  const withCompanyId = <T extends Record<string, unknown>>(data: T): T & { company_id: string | null } => {
    return {
      ...data,
      company_id: companyId,
    };
  };

  /**
   * Adds company_id to an array of objects for batch inserts.
   */
  const withCompanyIdArray = <T extends Record<string, unknown>>(dataArray: T[]): (T & { company_id: string | null })[] => {
    return dataArray.map(item => ({
      ...item,
      company_id: companyId,
    }));
  };

  /**
   * Get default company ID - useful for cases where we need a fallback
   */
  const getCompanyIdOrDefault = (): string => {
    return companyId || '00000000-0000-0000-0000-000000000002';
  };

  return {
    companyId,
    corporationId,
    company,
    corporation,
    isCorpAdmin,
    withCompanyId,
    withCompanyIdArray,
    getCompanyIdOrDefault,
  };
}
