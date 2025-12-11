import { useState, useCallback, useMemo } from "react";

export type LocationFilterValue = "all" | "location1" | "location2";

interface UseLocationFilterResult {
  selectedLocation: LocationFilterValue;
  setSelectedLocation: (value: LocationFilterValue) => void;
  filterByLocation: <T extends { location_id?: string | null }>(items: T[]) => T[];
  getUniqueLocationIds: <T extends { location_id?: string | null }>(items: T[]) => string[];
}

export function useLocationFilter(): UseLocationFilterResult {
  const [selectedLocation, setSelectedLocation] = useState<LocationFilterValue>("all");

  // Helper to get unique sorted location IDs from data
  const getUniqueLocationIds = useCallback(<T extends { location_id?: string | null }>(items: T[]): string[] => {
    const uniqueIds = [...new Set(items.map((item) => item.location_id).filter((id): id is string => Boolean(id)))];
    return uniqueIds.sort();
  }, []);

  const filterByLocation = useCallback(
    <T extends { location_id?: string | null }>(items: T[]): T[] => {
      if (selectedLocation === "all") {
        return items;
      }

      // Get unique location IDs from the data
      const uniqueLocationIds = getUniqueLocationIds(items);

      if (selectedLocation === "location1" && uniqueLocationIds.length >= 1) {
        return items.filter((item) => item.location_id === uniqueLocationIds[0]);
      }

      if (selectedLocation === "location2" && uniqueLocationIds.length >= 2) {
        return items.filter((item) => item.location_id === uniqueLocationIds[1]);
      }

      return items;
    },
    [selectedLocation, getUniqueLocationIds]
  );

  return {
    selectedLocation,
    setSelectedLocation,
    filterByLocation,
    getUniqueLocationIds,
  };
}
