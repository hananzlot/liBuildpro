import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Phone, Globe } from 'lucide-react';

interface CompanyInfo {
  logo_url?: string;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_website?: string;
  license_type?: string;
  license_number?: string;
  license_holder_name?: string;
  header_bg_color?: string;
}

// Helper to determine if a color is dark (for text contrast)
function isColorDark(color: string): boolean {
  if (!color) return false;
  
  let r = 0, g = 0, b = 0;
  
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  }
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

interface CompanyHeaderProps {
  companyId?: string | null;
}

export function CompanyHeader({ companyId }: CompanyHeaderProps = {}) {
  const { data: companyInfo } = useQuery({
    queryKey: ['company-info-header', companyId],
    queryFn: async () => {
      const settingKeys = [
        'company_logo_url',
        'company_name',
        'company_address',
        'company_phone',
        'company_website',
        'license_type',
        'license_number',
        'license_holder_name',
        'company_header_bg_color',
      ];

      // Try company_settings first if we have a companyId
      if (companyId) {
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('setting_key, setting_value')
          .eq('company_id', companyId)
          .in('setting_key', settingKeys);

        if (companyData && companyData.length > 0) {
          const settings: CompanyInfo = {};
          companyData.forEach((item) => {
            if (item.setting_key === 'company_logo_url') settings.logo_url = item.setting_value || undefined;
            if (item.setting_key === 'company_name') settings.company_name = item.setting_value || undefined;
            if (item.setting_key === 'company_address') settings.company_address = item.setting_value || undefined;
            if (item.setting_key === 'company_phone') settings.company_phone = item.setting_value || undefined;
            if (item.setting_key === 'company_website') settings.company_website = item.setting_value || undefined;
            if (item.setting_key === 'license_type') settings.license_type = item.setting_value || undefined;
            if (item.setting_key === 'license_number') settings.license_number = item.setting_value || undefined;
            if (item.setting_key === 'license_holder_name') settings.license_holder_name = item.setting_value || undefined;
            if (item.setting_key === 'company_header_bg_color') settings.header_bg_color = item.setting_value || undefined;
          });
          return settings;
        }
      }

      // Fall back to app_settings for backward compatibility
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', settingKeys);

      if (error) throw error;

      const settings: CompanyInfo = {};
      data?.forEach((item) => {
        if (item.setting_key === 'company_logo_url') settings.logo_url = item.setting_value || undefined;
        if (item.setting_key === 'company_name') settings.company_name = item.setting_value || undefined;
        if (item.setting_key === 'company_address') settings.company_address = item.setting_value || undefined;
        if (item.setting_key === 'company_phone') settings.company_phone = item.setting_value || undefined;
        if (item.setting_key === 'company_website') settings.company_website = item.setting_value || undefined;
        if (item.setting_key === 'license_type') settings.license_type = item.setting_value || undefined;
        if (item.setting_key === 'license_number') settings.license_number = item.setting_value || undefined;
        if (item.setting_key === 'license_holder_name') settings.license_holder_name = item.setting_value || undefined;
        if (item.setting_key === 'company_header_bg_color') settings.header_bg_color = item.setting_value || undefined;
      });

      return settings;
    },
  });

  // Don't render if no company info at all
  if (!companyInfo || (!companyInfo.logo_url && !companyInfo.company_name && !companyInfo.license_type)) {
    return null;
  }

  const isDark = companyInfo.header_bg_color ? isColorDark(companyInfo.header_bg_color) : false;
  const textColorClass = isDark ? 'text-white' : 'text-foreground';
  const mutedTextColorClass = isDark ? 'text-white/70' : 'text-muted-foreground';

  return (
    <div 
      className="border rounded-lg p-6 mb-6"
      style={{ backgroundColor: companyInfo.header_bg_color || undefined }}
    >
      <div className="flex flex-col md:flex-row md:items-start gap-6">
        {/* Logo */}
        {companyInfo.logo_url && (
          <div className="flex-shrink-0">
            <img
              src={companyInfo.logo_url}
              alt={companyInfo.company_name || 'Company Logo'}
              className="h-20 w-auto object-contain"
            />
          </div>
        )}

        {/* Company Info */}
        <div className="flex-1 space-y-2">
          {companyInfo.company_name && (
            <h2 className={`text-xl font-bold ${textColorClass}`}>{companyInfo.company_name}</h2>
          )}

          {/* License Info */}
          {(companyInfo.license_type || companyInfo.license_number || companyInfo.license_holder_name) && (
            <div className={`text-sm ${mutedTextColorClass} space-y-0.5`}>
              {companyInfo.license_holder_name && (
                <p className={`font-medium ${textColorClass}`}>{companyInfo.license_holder_name}</p>
              )}
              {(companyInfo.license_type || companyInfo.license_number) && (
                <p>
                  {companyInfo.license_type && <span>{companyInfo.license_type}</span>}
                  {companyInfo.license_type && companyInfo.license_number && <span> • </span>}
                  {companyInfo.license_number && <span>License #{companyInfo.license_number}</span>}
                </p>
              )}
            </div>
          )}

          {/* Contact Info */}
          <div className={`flex flex-wrap gap-x-6 gap-y-2 text-sm ${mutedTextColorClass} pt-1`}>
            {companyInfo.company_address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {companyInfo.company_address}
              </span>
            )}
            {companyInfo.company_phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                {companyInfo.company_phone}
              </span>
            )}
            {companyInfo.company_website && (
              <span className="flex items-center gap-1.5">
                <Globe className="h-4 w-4" />
                {companyInfo.company_website}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
