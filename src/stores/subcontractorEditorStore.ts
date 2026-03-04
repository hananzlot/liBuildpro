import { create } from "zustand";

const SUBCONTRACTOR_TYPES = ['Material/Equipment', 'Other', 'Subcontractor'] as const;
type SubcontractorType = typeof SUBCONTRACTOR_TYPES[number];

export interface SubcontractorFormData {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  license_number: string;
  license_expiration_date: string;
  license_document_url: string;
  insurance_expiration_date: string;
  insurance_document_url: string;
  notes: string;
  is_active: boolean;
  do_not_require_license: boolean;
  do_not_require_insurance: boolean;
  subcontractor_type: SubcontractorType;
  trade: string[];
}

export const DEFAULT_FORM_DATA: SubcontractorFormData = {
  company_name: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  license_number: "",
  license_expiration_date: "",
  license_document_url: "",
  insurance_expiration_date: "",
  insurance_document_url: "",
  notes: "",
  is_active: true,
  do_not_require_license: false,
  do_not_require_insurance: false,
  subcontractor_type: "Subcontractor",
  trade: [],
};

interface SubcontractorEditorStore {
  /** Keyed by subcontractorId or "new" */
  drafts: Record<string, SubcontractorFormData>;
  setDraft: (key: string, data: SubcontractorFormData) => void;
  updateDraft: (key: string, partial: Partial<SubcontractorFormData>) => void;
  clearDraft: (key: string) => void;
}

export const useSubcontractorEditorStore = create<SubcontractorEditorStore>((set) => ({
  drafts: {},
  setDraft: (key, data) =>
    set((state) => ({ drafts: { ...state.drafts, [key]: data } })),
  updateDraft: (key, partial) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [key]: { ...(state.drafts[key] || DEFAULT_FORM_DATA), ...partial },
      },
    })),
  clearDraft: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.drafts;
      return { drafts: rest };
    }),
}));
