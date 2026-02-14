import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, 
  FileText, 
  ExternalLink, 
  Award,
  Download
} from 'lucide-react';

interface PortalCredentialsProps {
  companyId: string;
}

interface CredentialFile {
  label: string;
  url: string;
  type: 'license' | 'insurance';
}

export function PortalCredentials({ companyId }: PortalCredentialsProps) {
  const { data: credentials, isLoading } = useQuery({
    queryKey: ['portal-credentials', companyId],
    queryFn: async () => {
      const settingKeys = [
        // Insurance docs (admin stores as insurance_doc_*)
        'insurance_doc_general_liability_url',
        'insurance_doc_general_liability_name',
        'insurance_doc_workers_comp_url',
        'insurance_doc_workers_comp_name',
        'insurance_doc_custom_count',
        'insurance_doc_custom_1_url',
        'insurance_doc_custom_1_name',
        'insurance_doc_custom_1_label',
        'insurance_doc_custom_2_url',
        'insurance_doc_custom_2_name',
        'insurance_doc_custom_2_label',
        'insurance_doc_custom_3_url',
        'insurance_doc_custom_3_name',
        'insurance_doc_custom_3_label',
        // License/cert docs
        'license_cert_gc_license_url',
        'license_cert_gc_license_name',
        'license_cert_custom_count',
        'license_cert_custom_1_url',
        'license_cert_custom_1_name',
        'license_cert_custom_1_label',
        'license_cert_custom_2_url',
        'license_cert_custom_2_name',
        'license_cert_custom_2_label',
        'license_cert_custom_3_url',
        'license_cert_custom_3_name',
        'license_cert_custom_3_label',
        'license_cert_custom_4_url',
        'license_cert_custom_4_name',
        'license_cert_custom_4_label',
        'license_cert_custom_5_url',
        'license_cert_custom_5_name',
        'license_cert_custom_5_label',
        // License info
        'license_type',
        'license_number',
        'license_holder_name',
      ];

      const { data } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', companyId)
        .in('setting_key', settingKeys);

      const map = new Map(data?.map(s => [s.setting_key, s.setting_value || '']) || []);

      const licenses: CredentialFile[] = [];
      const insurance: CredentialFile[] = [];

      // GC License
      const gcUrl = map.get('license_cert_gc_license_url');
      if (gcUrl) {
        licenses.push({
          label: map.get('license_cert_gc_license_name') || 'General Contractor License',
          url: gcUrl,
          type: 'license',
        });
      }

      // Custom licenses
      const licenseCustomCount = parseInt(map.get('license_cert_custom_count') || '0', 10) || 0;
      for (let i = 1; i <= Math.max(licenseCustomCount, 5); i++) {
        const url = map.get(`license_cert_custom_${i}_url`);
        if (url) {
          licenses.push({
            label: map.get(`license_cert_custom_${i}_label`) || map.get(`license_cert_custom_${i}_name`) || `Certificate ${i}`,
            url,
            type: 'license',
          });
        }
      }

      // General Liability
      const glUrl = map.get('insurance_doc_general_liability_url');
      if (glUrl) {
        insurance.push({
          label: map.get('insurance_doc_general_liability_name') || 'General Liability',
          url: glUrl,
          type: 'insurance',
        });
      }

      // Workers Comp
      const wcUrl = map.get('insurance_doc_workers_comp_url');
      if (wcUrl) {
        insurance.push({
          label: map.get('insurance_doc_workers_comp_name') || 'Workers Compensation',
          url: wcUrl,
          type: 'insurance',
        });
      }

      // Custom insurance
      const insuranceCustomCount = parseInt(map.get('insurance_doc_custom_count') || '0', 10) || 0;
      for (let i = 1; i <= Math.max(insuranceCustomCount, 3); i++) {
        const url = map.get(`insurance_doc_custom_${i}_url`);
        if (url) {
          insurance.push({
            label: map.get(`insurance_doc_custom_${i}_label`) || map.get(`insurance_doc_custom_${i}_name`) || `Insurance Policy ${i}`,
            url,
            type: 'insurance',
          });
        }
      }

      return {
        licenses,
        insurance,
        licenseType: map.get('license_type') || '',
        licenseNumber: map.get('license_number') || '',
        licenseHolder: map.get('license_holder_name') || '',
      };
    },
    enabled: !!companyId,
  });

  const allFiles = [...(credentials?.licenses || []), ...(credentials?.insurance || [])];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-6 sm:p-8 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Licenses & Insurance</h2>
              <p className="text-white/70 text-sm mt-1">
                Our credentials and proof of coverage
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* License Info Summary */}
      {(credentials?.licenseHolder || credentials?.licenseNumber) && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Award className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                {credentials.licenseHolder && (
                  <p className="font-semibold text-slate-900">{credentials.licenseHolder}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {credentials.licenseType && (
                    <Badge variant="outline" className="text-xs">{credentials.licenseType}</Badge>
                  )}
                  {credentials.licenseNumber && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                      License #{credentials.licenseNumber}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Licenses Section */}
      {credentials?.licenses && credentials.licenses.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-1">
            Licenses & Certificates
          </h3>
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {credentials.licenses.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 ring-1 ring-emerald-200">
                      <Award className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{file.label}</p>
                      <p className="text-xs text-slate-500">License / Certificate</p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="shadow-sm shrink-0">
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">View</span>
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Insurance Section */}
      {credentials?.insurance && credentials.insurance.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-1">
            Insurance Policies
          </h3>
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {credentials.insurance.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 ring-1 ring-blue-200">
                      <ShieldCheck className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{file.label}</p>
                      <p className="text-xs text-slate-500">Insurance Policy</p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="shadow-sm shrink-0">
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">View</span>
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {allFiles.length === 0 && (
        <Card className="border-0 shadow-lg">
          <CardContent className="py-20 text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Credentials Available</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              License and insurance documents will appear here once uploaded by the company.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
