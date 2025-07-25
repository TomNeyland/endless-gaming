/**
 * Utilities for calculating and formatting game age information.
 * Handles Steam's release date format: "Aug 21, 2012", "15 Jan, 2024", etc.
 */

export type AgeCategory = 'new' | 'recent' | 'established' | 'classic';

/**
 * Parse Steam's release date format to a Date object.
 * Handles formats like "Aug 21, 2012", "15 Jan, 2024", "Coming soon", etc.
 * 
 * @param releaseDate Steam release date string
 * @returns Date object or null if parsing fails
 */
export function parseReleaseDate(releaseDate: string | null | undefined): Date | null {
  if (!releaseDate) return null;
  
  // Handle special cases
  const lowerDate = releaseDate.toLowerCase();
  if (lowerDate.includes('coming soon') || lowerDate.includes('tbd') || lowerDate.includes('to be announced')) {
    return null;
  }
  
  try {
    // Steam uses formats like "Aug 21, 2012" or "15 Jan, 2024"
    // JavaScript Date constructor can parse these directly
    const parsed = new Date(releaseDate);
    
    // Check if the date is valid and not in the future (with some buffer)
    const now = new Date();
    const futureBuffer = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
    
    if (isNaN(parsed.getTime()) || parsed > futureBuffer) {
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.warn('Failed to parse release date:', releaseDate, error);
    return null;
  }
}

/**
 * Calculate the age of a game in years from its release date.
 * 
 * @param releaseDate Steam release date string
 * @returns Age in years (decimal) or null if date cannot be parsed
 */
export function calculateGameAge(releaseDate: string | null | undefined): number | null {
  const parsedDate = parseReleaseDate(releaseDate);
  if (!parsedDate) return null;
  
  const now = new Date();
  const ageInMs = now.getTime() - parsedDate.getTime();
  const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25); // Account for leap years
  
  return Math.max(0, ageInYears); // Ensure non-negative
}

/**
 * Categorize a game by its age.
 * 
 * @param ageInYears Age in years (from calculateGameAge)
 * @returns Age category
 */
export function getAgeCategory(ageInYears: number | null): AgeCategory | null {
  if (ageInYears === null) return null;
  
  if (ageInYears < 1) return 'new';        // Less than 1 year
  if (ageInYears < 3) return 'recent';     // 1-3 years
  if (ageInYears < 7) return 'established'; // 3-7 years
  return 'classic';                        // 7+ years
}

/**
 * Get a human-readable age category label.
 * 
 * @param category Age category
 * @returns Display label
 */
export function getAgeCategoryLabel(category: AgeCategory): string {
  switch (category) {
    case 'new': return 'New';
    case 'recent': return 'Recent'; 
    case 'established': return 'Established';
    case 'classic': return 'Classic';
  }
}

/**
 * Format game age for display.
 * Examples: "Released March 2020 (4 years ago)", "Released last year", "New release"
 * 
 * @param releaseDate Steam release date string
 * @returns Formatted age string
 */
export function formatGameAge(releaseDate: string | null | undefined): string {
  const parsedDate = parseReleaseDate(releaseDate);
  if (!parsedDate) return 'Release date unknown';
  
  const ageInYears = calculateGameAge(releaseDate);
  if (ageInYears === null) return 'Release date unknown';
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const month = monthNames[parsedDate.getMonth()];
  const year = parsedDate.getFullYear();
  
  // Format based on age
  if (ageInYears < 0.1) {
    return `Released ${month} ${year} (new release)`;
  } else if (ageInYears < 1) {
    const months = Math.floor(ageInYears * 12);
    if (months === 0) {
      return `Released ${month} ${year} (this month)`;
    } else if (months === 1) {
      return `Released ${month} ${year} (1 month ago)`;
    } else {
      return `Released ${month} ${year} (${months} months ago)`;
    }
  } else if (ageInYears < 2) {
    return `Released ${month} ${year} (1 year ago)`;
  } else {
    const years = Math.floor(ageInYears);
    return `Released ${month} ${year} (${years} years ago)`;
  }
}

/**
 * Get a short age badge text for display in cards.
 * Examples: "New", "2 years", "Classic"
 * 
 * @param releaseDate Steam release date string
 * @returns Short age badge text
 */
export function getAgeBadge(releaseDate: string | null | undefined): string {
  const ageInYears = calculateGameAge(releaseDate);
  if (ageInYears === null) return '';
  
  const category = getAgeCategory(ageInYears);
  if (!category) return '';
  
  if (category === 'new') return 'New';
  if (category === 'classic') return 'Classic';
  
  const years = Math.floor(ageInYears);
  if (years === 1) return '1 year';
  return `${years} years`;
}

/**
 * Extract release year from release date for filtering.
 * 
 * @param releaseDate Steam release date string
 * @returns Release year or null if cannot be determined
 */
export function getReleaseYear(releaseDate: string | null | undefined): number | null {
  const parsedDate = parseReleaseDate(releaseDate);
  return parsedDate ? parsedDate.getFullYear() : null;
}

/**
 * Check if a game matches age filter criteria.
 * 
 * @param releaseDate Steam release date string
 * @param ageCategories Array of age categories to match
 * @param yearRange Year range filter {min, max}
 * @param maxAge Maximum age in years
 * @returns True if game matches age criteria
 */
export function matchesAgeFilter(
  releaseDate: string | null | undefined,
  ageCategories: AgeCategory[],
  yearRange?: { min: number; max: number },
  maxAge?: number | null
): boolean {
  const ageInYears = calculateGameAge(releaseDate);
  const releaseYear = getReleaseYear(releaseDate);
  const category = getAgeCategory(ageInYears);
  
  // If we can't determine age, exclude from age-based filters
  if (ageInYears === null || !category || !releaseYear) {
    return ageCategories.length === 0 && !yearRange && !maxAge;
  }
  
  // Check age categories
  if (ageCategories.length > 0 && !ageCategories.includes(category)) {
    return false;
  }
  
  // Check year range
  if (yearRange && (releaseYear < yearRange.min || releaseYear > yearRange.max)) {
    return false;
  }
  
  // Check max age
  if (maxAge !== null && maxAge !== undefined && ageInYears > maxAge) {
    return false;
  }
  
  return true;
}