import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE_COMPANY_ID = "00000000-0000-0000-0000-000000000002"; // CA Pro Builders
const TARGET_COMPANY_ID = "d95f6df1-ef3c-4e12-8743-69c6bfb280bc"; // Demo Co #1

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  // UUID mapping tables
  const contactMap = new Map<string, string>();
  const opportunityMap = new Map<string, string>();
  const projectMap = new Map<string, string>();
  const estimateMap = new Map<string, string>();
  const invoiceMap = new Map<string, string>();
  const billMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  const salespersonMap = new Map<string, string>();
  const bankMap = new Map<string, string>();
  const templateMap = new Map<string, string>();

  try {
    // ========== STEP 1: CLEAR TARGET DATA ==========
    log("=== STEP 1: Clearing Demo Co #1 data ===");

    const deleteOrder = [
      "bill_payments", "project_payments", "project_invoices", "project_bills",
      "project_costs", "project_payment_phases", "commission_payments",
      "estimate_line_items", "estimate_groups", "estimate_payment_schedule",
      "estimate_attachments", "estimate_signatures", "estimate_signers",
      "client_portal_tokens", "portal_chat_messages",
      "project_notes", "project_agreements", "project_documents",
      "project_checklists", "project_commissions", "project_feedback",
      "project_notification_log",
      "contact_notes", "tasks",
      "appointment_edits", "appointment_reminders",
      "opportunity_edits", "task_edits", "note_edits",
      "magazine_sales", "magazine_sales_edits",
      "scope_submissions", "short_links", "short_link_clicks",
      "call_logs", "conversations",
      "client_comments",
      "compliance_template_fields", "compliance_document_templates",
      "document_signatures", "document_signers", "document_signature_fields",
      "document_portal_tokens", "signature_documents",
      "salesperson_portal_tokens",
      "projects", "estimates",
      "appointments", "opportunities", "contacts",
      "notifications",
      "company_settings", "pipeline_stages", "salespeople",
      "subcontractors", "trades", "banks", "archived_sources",
      "lead_sources", "project_statuses", "project_types",
    ];

    for (const table of deleteOrder) {
      const { error, count } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .eq("company_id", TARGET_COMPANY_ID);
      if (error) {
        log(`  WARN deleting ${table}: ${error.message}`);
      } else {
        log(`  Deleted ${count ?? 0} from ${table}`);
      }
    }

    // Helper to fetch all rows with pagination
    async function fetchAll(table: string, companyId: string, companyCol = "company_id") {
      const allRows: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq(companyCol, companyId)
          .range(from, from + pageSize - 1);
        if (error) throw new Error(`Fetch ${table}: ${error.message}`);
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    }

    // Known fields that don't exist on certain tables - strip them during insert
    const stripFields: Record<string, string[]> = {
      opportunities: ["edited_by", "edited_at"],
      project_invoices: ["created_by"],
      project_documents: ["uploaded_by"],
      portal_chat_messages: ["sent_by"],
      magazine_sales: ["created_by", "opportunity_id"],
      short_links: ["created_by"],
      project_costs: ["project_id"],
      scope_submissions: ["project_id"],
      tasks: ["contact_uuid", "project_id"],
    };

    function cleanRow(table: string, row: any): any {
      const fieldsToStrip = stripFields[table];
      if (!fieldsToStrip) return row;
      const cleaned = { ...row };
      for (const f of fieldsToStrip) {
        delete cleaned[f];
      }
      return cleaned;
    }

    // Helper to batch insert with column cleaning
    async function batchInsert(table: string, rows: any[]) {
      if (rows.length === 0) return;
      const cleanedRows = rows.map(r => cleanRow(table, r));
      const batchSize = 500;
      for (let i = 0; i < cleanedRows.length; i += batchSize) {
        const batch = cleanedRows.slice(i, i + batchSize);
        const { error } = await supabase.from(table).insert(batch);
        if (error) throw new Error(`Insert ${table} batch ${i}: ${error.message}`);
      }
    }

    // ========== STEP 2: COPY CONFIG TABLES ==========
    log("=== STEP 2: Copying config tables ===");

    // company_settings - copy all including encrypted keys
    const settings = await fetchAll("company_settings", SOURCE_COMPANY_ID);
    const newSettings = settings.map(s => {
      const { id, ...rest } = s;
      return { ...rest, company_id: TARGET_COMPANY_ID, updated_by: null };
    });
    await batchInsert("company_settings", newSettings);
    log(`  Copied ${newSettings.length} company_settings`);

    // pipeline_stages
    const stages = await fetchAll("pipeline_stages", SOURCE_COMPANY_ID);
    const newStages = stages.map(s => {
      const { id, ...rest } = s;
      return { ...rest, company_id: TARGET_COMPANY_ID };
    });
    await batchInsert("pipeline_stages", newStages);
    log(`  Copied ${newStages.length} pipeline_stages`);

    // salespeople
    const salespeople = await fetchAll("salespeople", SOURCE_COMPANY_ID);
    const newSalespeople = salespeople.map(s => {
      const newId = crypto.randomUUID();
      salespersonMap.set(s.id, newId);
      const { id, ...rest } = s;
      return { id: newId, ...rest, company_id: TARGET_COMPANY_ID };
    });
    await batchInsert("salespeople", newSalespeople);
    log(`  Copied ${newSalespeople.length} salespeople`);

    // subcontractors
    const subs = await fetchAll("subcontractors", SOURCE_COMPANY_ID);
    const newSubs = subs.map(s => {
      const { id, ...rest } = s;
      return { ...rest, company_id: TARGET_COMPANY_ID };
    });
    await batchInsert("subcontractors", newSubs);
    log(`  Copied ${newSubs.length} subcontractors`);

    // trades (no company_id - check schema)
    // trades has company_id based on schema summary
    try {
      const trades = await fetchAll("trades", SOURCE_COMPANY_ID);
      const newTrades = trades.map(t => {
        const { id, ...rest } = t;
        return { ...rest, company_id: TARGET_COMPANY_ID };
      });
      await batchInsert("trades", newTrades);
      log(`  Copied ${newTrades.length} trades`);
    } catch (e) {
      log(`  WARN trades: ${e.message}`);
    }

    // banks
    const banks = await fetchAll("banks", SOURCE_COMPANY_ID);
    const newBanks = banks.map(b => {
      const newId = crypto.randomUUID();
      bankMap.set(b.id, newId);
      const { id, ...rest } = b;
      return { id: newId, ...rest, company_id: TARGET_COMPANY_ID, created_by: null };
    });
    await batchInsert("banks", newBanks);
    log(`  Copied ${newBanks.length} banks`);

    // archived_sources
    const archivedSources = await fetchAll("archived_sources", SOURCE_COMPANY_ID);
    const newAS = archivedSources.map(a => {
      const { id, ...rest } = a;
      return { ...rest, company_id: TARGET_COMPANY_ID, archived_by: null };
    });
    await batchInsert("archived_sources", newAS);
    log(`  Copied ${newAS.length} archived_sources`);

    // lead_sources
    try {
      const leadSources = await fetchAll("lead_sources", SOURCE_COMPANY_ID);
      const newLeadSources = leadSources.map(ls => {
        const { id, ...rest } = ls;
        return { ...rest, company_id: TARGET_COMPANY_ID };
      });
      await batchInsert("lead_sources", newLeadSources);
      log(`  Copied ${newLeadSources.length} lead_sources`);
    } catch (e) {
      log(`  WARN lead_sources: ${e.message}`);
    }

    // project_statuses
    try {
      const statuses = await fetchAll("project_statuses", SOURCE_COMPANY_ID);
      const newStatuses = statuses.map(s => {
        const { id, ...rest } = s;
        return { ...rest, company_id: TARGET_COMPANY_ID };
      });
      await batchInsert("project_statuses", newStatuses);
      log(`  Copied ${newStatuses.length} project_statuses`);
    } catch (e) {
      log(`  WARN project_statuses: ${e.message}`);
    }

    // project_types
    try {
      const types = await fetchAll("project_types", SOURCE_COMPANY_ID);
      const newTypes = types.map(t => {
        const { id, ...rest } = t;
        return { ...rest, company_id: TARGET_COMPANY_ID };
      });
      await batchInsert("project_types", newTypes);
      log(`  Copied ${newTypes.length} project_types`);
    } catch (e) {
      log(`  WARN project_types: ${e.message}`);
    }

    // compliance_document_templates
    const templates = await fetchAll("compliance_document_templates", SOURCE_COMPANY_ID);
    const newTemplates = templates.map(t => {
      const newId = crypto.randomUUID();
      templateMap.set(t.id, newId);
      const { id, ...rest } = t;
      return { id: newId, ...rest, company_id: TARGET_COMPANY_ID, created_by: null };
    });
    await batchInsert("compliance_document_templates", newTemplates);
    log(`  Copied ${newTemplates.length} compliance_document_templates`);

    // compliance_template_fields
    const fields = await fetchAll("compliance_template_fields", SOURCE_COMPANY_ID);
    const newFields = fields.map(f => {
      const { id, ...rest } = f;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        template_id: templateMap.get(f.template_id) || f.template_id,
      };
    });
    await batchInsert("compliance_template_fields", newFields);
    log(`  Copied ${newFields.length} compliance_template_fields`);

    // ========== STEP 3: COPY CRM CORE ==========
    log("=== STEP 3: Copying CRM core tables ===");

    // contacts
    const contacts = await fetchAll("contacts", SOURCE_COMPANY_ID);
    const newContacts = contacts.map(c => {
      const newId = crypto.randomUUID();
      contactMap.set(c.id, newId);
      const { id, ...rest } = c;
      return { id: newId, ...rest, company_id: TARGET_COMPANY_ID, entered_by: null, ghl_id: null, external_id: null };
    });
    await batchInsert("contacts", newContacts);
    log(`  Copied ${newContacts.length} contacts`);

    // opportunities
    const opps = await fetchAll("opportunities", SOURCE_COMPANY_ID);
    const newOpps = opps.map(o => {
      const newId = crypto.randomUUID();
      opportunityMap.set(o.id, newId);
      // Also map by ghl_id for project_costs lookup
      if (o.ghl_id) {
        opportunityMap.set(o.ghl_id, newId);
      }
      const { id, edited_by, edited_at, ...rest } = o;
      return {
        id: newId, ...rest,
        company_id: TARGET_COMPANY_ID,
        contact_uuid: o.contact_uuid ? (contactMap.get(o.contact_uuid) || null) : null,
        entered_by: null,
        ghl_id: null, external_id: null,
        salesperson_id: o.salesperson_id ? (salespersonMap.get(o.salesperson_id) || null) : null,
      };
    });
    await batchInsert("opportunities", newOpps);
    log(`  Copied ${newOpps.length} opportunities`);

    // appointments
    const appts = await fetchAll("appointments", SOURCE_COMPANY_ID);
    const newAppts = appts.map(a => {
      const newId = crypto.randomUUID();
      const { id, ...rest } = a;
      return {
        id: newId, ...rest,
        company_id: TARGET_COMPANY_ID,
        contact_uuid: a.contact_uuid ? (contactMap.get(a.contact_uuid) || null) : null,
        salesperson_id: a.salesperson_id ? (salespersonMap.get(a.salesperson_id) || null) : null,
        entered_by: null, edited_by: null,
        ghl_id: null, external_id: null,
      };
    });
    await batchInsert("appointments", newAppts);
    log(`  Copied ${newAppts.length} appointments`);

    // ========== STEP 4: COPY PROJECTS ==========
    log("=== STEP 4: Copying project tables ===");

    const projects = await fetchAll("projects", SOURCE_COMPANY_ID);
    const newProjects = projects.map(p => {
      const newId = crypto.randomUUID();
      projectMap.set(p.id, newId);
      const { id, ...rest } = p;
      return {
        id: newId, ...rest,
        company_id: TARGET_COMPANY_ID,
        contact_uuid: p.contact_uuid ? (contactMap.get(p.contact_uuid) || null) : null,
        opportunity_uuid: p.opportunity_uuid ? (opportunityMap.get(p.opportunity_uuid) || null) : null,
        created_by: null,
      };
    });
    await batchInsert("projects", newProjects);
    log(`  Copied ${newProjects.length} projects`);

    // project_notes
    const pnotes = await fetchAll("project_notes", SOURCE_COMPANY_ID);
    const newPNotes = pnotes.map(n => {
      const { id, ...rest } = n;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        project_id: n.project_id ? (projectMap.get(n.project_id) || n.project_id) : null,
      };
    });
    await batchInsert("project_notes", newPNotes);
    log(`  Copied ${newPNotes.length} project_notes`);

    // project_agreements
    const agreements = await fetchAll("project_agreements", SOURCE_COMPANY_ID);
    const newAgreements = agreements.map(a => {
      const { id, ...rest } = a;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        project_id: a.project_id ? (projectMap.get(a.project_id) || a.project_id) : null,
      };
    });
    await batchInsert("project_agreements", newAgreements);
    log(`  Copied ${newAgreements.length} project_agreements`);

    // project_documents
    const pdocs = await fetchAll("project_documents", SOURCE_COMPANY_ID);
    const newPDocs = pdocs.map(d => {
      const { id, ...rest } = d;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        project_id: d.project_id ? (projectMap.get(d.project_id) || d.project_id) : null,
      };
    });
    await batchInsert("project_documents", newPDocs);
    log(`  Copied ${newPDocs.length} project_documents`);

    // project_invoices
    const invoices = await fetchAll("project_invoices", SOURCE_COMPANY_ID);
    const newInvoices = invoices.map(inv => {
      const newId = crypto.randomUUID();
      invoiceMap.set(inv.id, newId);
      const { id, ...rest } = inv;
      return {
        id: newId, ...rest,
        company_id: TARGET_COMPANY_ID,
        project_id: inv.project_id ? (projectMap.get(inv.project_id) || inv.project_id) : null,
      };
    });
    await batchInsert("project_invoices", newInvoices);
    log(`  Copied ${newInvoices.length} project_invoices`);

    // project_payments
    const payments = await fetchAll("project_payments", SOURCE_COMPANY_ID);
    const newPayments = payments.map(p => {
      const { id, ...rest } = p;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        project_id: p.project_id ? (projectMap.get(p.project_id) || p.project_id) : null,
        invoice_id: p.invoice_id ? (invoiceMap.get(p.invoice_id) || null) : null,
        bank_id: p.bank_id ? (bankMap.get(p.bank_id) || null) : null,
      };
    });
    await batchInsert("project_payments", newPayments);
    log(`  Copied ${newPayments.length} project_payments`);

    // project_bills
    const bills = await fetchAll("project_bills", SOURCE_COMPANY_ID);
    const newBills = bills.map(b => {
      const newId = crypto.randomUUID();
      billMap.set(b.id, newId);
      const { id, ...rest } = b;
      return {
        id: newId, ...rest,
        company_id: TARGET_COMPANY_ID,
        project_id: b.project_id ? (projectMap.get(b.project_id) || b.project_id) : null,
      };
    });
    await batchInsert("project_bills", newBills);
    log(`  Copied ${newBills.length} project_bills`);

    // bill_payments
    const billPayments = await fetchAll("bill_payments", SOURCE_COMPANY_ID);
    const newBillPayments = billPayments.map(bp => {
      const { id, ...rest } = bp;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        bill_id: bp.bill_id ? (billMap.get(bp.bill_id) || bp.bill_id) : bp.bill_id,
        bank_id: bp.bank_id ? (bankMap.get(bp.bank_id) || null) : null,
      };
    });
    await batchInsert("bill_payments", newBillPayments);
    log(`  Copied ${newBillPayments.length} bill_payments`);

    // project_costs (opportunity_id is GHL ID, need to map via ghl_id)
    const costs = await fetchAll("project_costs", SOURCE_COMPANY_ID);
    const newCosts = costs.map(c => {
      const { id, ...rest } = c;
      // Look up the opportunity by ghl_id to find the new UUID
      const newOppId = c.opportunity_id ? (opportunityMap.get(c.opportunity_id) || null) : null;
      if (!newOppId && c.opportunity_id) {
        log(`  WARN: project_costs ${c.id} has opportunity_id=${c.opportunity_id} but no mapping found`);
      }
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        opportunity_id: newOppId,
      };
    }).filter(c => c.opportunity_id !== null); // Skip costs with no mapped opportunity
    await batchInsert("project_costs", newCosts);
    log(`  Copied ${newCosts.length} project_costs (skipped ${costs.length - newCosts.length} with unmapped opportunities)`);

    // project_payment_phases
    const phases = await fetchAll("project_payment_phases", SOURCE_COMPANY_ID);
    const newPhases = phases.map(p => {
      const { id, ...rest } = p;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        project_id: p.project_id ? (projectMap.get(p.project_id) || p.project_id) : null,
      };
    });
    await batchInsert("project_payment_phases", newPhases);
    log(`  Copied ${newPhases.length} project_payment_phases`);

    // ========== STEP 5: COPY ESTIMATES ==========
    log("=== STEP 5: Copying estimate tables ===");

    const estimates = await fetchAll("estimates", SOURCE_COMPANY_ID);
    const newEstimates = estimates.map(e => {
      const newId = crypto.randomUUID();
      estimateMap.set(e.id, newId);
      const { id, ...rest } = e;
      return {
        id: newId, ...rest,
        company_id: TARGET_COMPANY_ID,
        contact_uuid: e.contact_uuid ? (contactMap.get(e.contact_uuid) || null) : null,
        project_id: e.project_id ? (projectMap.get(e.project_id) || null) : null,
        opportunity_uuid: e.opportunity_id ? (opportunityMap.get(e.opportunity_id) || null) : null,
        opportunity_id: null,
        created_by: null,
      };
    });
    await batchInsert("estimates", newEstimates);
    log(`  Copied ${newEstimates.length} estimates`);

    // estimate_groups
    const groups = await fetchAll("estimate_groups", SOURCE_COMPANY_ID);
    const newGroups = groups.map(g => {
      const newId = crypto.randomUUID();
      groupMap.set(g.id, newId);
      const { id, ...rest } = g;
      return {
        id: newId, ...rest,
        company_id: TARGET_COMPANY_ID,
        estimate_id: g.estimate_id ? (estimateMap.get(g.estimate_id) || g.estimate_id) : null,
      };
    });
    await batchInsert("estimate_groups", newGroups);
    log(`  Copied ${newGroups.length} estimate_groups`);

    // estimate_line_items
    const lineItems = await fetchAll("estimate_line_items", SOURCE_COMPANY_ID);
    const newLineItems = lineItems.map(li => {
      const { id, ...rest } = li;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        estimate_id: li.estimate_id ? (estimateMap.get(li.estimate_id) || li.estimate_id) : null,
        group_id: li.group_id ? (groupMap.get(li.group_id) || null) : null,
      };
    });
    await batchInsert("estimate_line_items", newLineItems);
    log(`  Copied ${newLineItems.length} estimate_line_items`);

    // estimate_payment_schedule
    const schedules = await fetchAll("estimate_payment_schedule", SOURCE_COMPANY_ID);
    const newSchedules = schedules.map(s => {
      const { id, ...rest } = s;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        estimate_id: s.estimate_id ? (estimateMap.get(s.estimate_id) || s.estimate_id) : null,
      };
    });
    await batchInsert("estimate_payment_schedule", newSchedules);
    log(`  Copied ${newSchedules.length} estimate_payment_schedule`);

    // ========== STEP 6: COPY REMAINING ==========
    log("=== STEP 6: Copying remaining tables ===");

    // contact_notes
    const cnotes = await fetchAll("contact_notes", SOURCE_COMPANY_ID);
    const newCNotes = cnotes.map(n => {
      const { id, ...rest } = n;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        contact_uuid: n.contact_uuid ? (contactMap.get(n.contact_uuid) || null) : null,
        entered_by: null, edited_by: null,
        ghl_id: null, external_id: null,
      };
    });
    await batchInsert("contact_notes", newCNotes);
    log(`  Copied ${newCNotes.length} contact_notes`);

    // tasks
    const tasks = await fetchAll("tasks", SOURCE_COMPANY_ID);
    const newTasks = tasks.map(t => {
      const { id, ...rest } = t;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        contact_uuid: t.contact_uuid ? (contactMap.get(t.contact_uuid) || null) : null,
        project_id: t.project_id ? (projectMap.get(t.project_id) || null) : null,
      };
    });
    await batchInsert("tasks", newTasks);
    log(`  Copied ${newTasks.length} tasks`);

    // client_portal_tokens
    const tokens = await fetchAll("client_portal_tokens", SOURCE_COMPANY_ID);
    const newTokens = tokens.map(t => {
      const { id, ...rest } = t;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        project_id: t.project_id ? (projectMap.get(t.project_id) || null) : null,
        estimate_id: t.estimate_id ? (estimateMap.get(t.estimate_id) || null) : null,
        created_by: null,
      };
    });
    await batchInsert("client_portal_tokens", newTokens);
    log(`  Copied ${newTokens.length} client_portal_tokens`);

    // portal_chat_messages
    const chatMsgs = await fetchAll("portal_chat_messages", SOURCE_COMPANY_ID);
    const newChatMsgs = chatMsgs.map(m => {
      const { id, ...rest } = m;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        project_id: m.project_id ? (projectMap.get(m.project_id) || null) : null,
        sent_by: null,
      };
    });
    await batchInsert("portal_chat_messages", newChatMsgs);
    log(`  Copied ${newChatMsgs.length} portal_chat_messages`);

    // magazine_sales
    const magSales = await fetchAll("magazine_sales", SOURCE_COMPANY_ID);
    const newMagSales = magSales.map(m => {
      const { id, ...rest } = m;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        opportunity_id: m.opportunity_id ? (opportunityMap.get(m.opportunity_id) || null) : null,
        created_by: null,
      };
    });
    await batchInsert("magazine_sales", newMagSales);
    log(`  Copied ${newMagSales.length} magazine_sales`);

    // short_links
    const links = await fetchAll("short_links", SOURCE_COMPANY_ID);
    const newLinks = links.map(l => {
      const { id, ...rest } = l;
      return {
        ...rest,
        company_id: TARGET_COMPANY_ID,
        // Generate new short code to avoid conflicts
        short_code: l.short_code + "_demo",
        created_by: null,
      };
    });
    await batchInsert("short_links", newLinks);
    log(`  Copied ${newLinks.length} short_links`);

    // scope_submissions
    try {
      const scopeSubs = await fetchAll("scope_submissions", SOURCE_COMPANY_ID);
      const newScopeSubs = scopeSubs.map(s => {
        const { id, ...rest } = s;
        return {
          ...rest,
          company_id: TARGET_COMPANY_ID,
          project_id: s.project_id ? (projectMap.get(s.project_id) || null) : null,
          estimate_id: s.estimate_id ? (estimateMap.get(s.estimate_id) || null) : null,
          salesperson_id: s.salesperson_id ? (salespersonMap.get(s.salesperson_id) || null) : null,
        };
      });
      await batchInsert("scope_submissions", newScopeSubs);
      log(`  Copied ${newScopeSubs.length} scope_submissions`);
    } catch (e) {
      log(`  WARN scope_submissions: ${e.message}`);
    }

    log("=== REPLICATION COMPLETE ===");
    log(`  Contact mappings: ${contactMap.size}`);
    log(`  Opportunity mappings: ${opportunityMap.size}`);
    log(`  Project mappings: ${projectMap.size}`);
    log(`  Estimate mappings: ${estimateMap.size}`);

    return new Response(
      JSON.stringify({ success: true, logs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log(`FATAL ERROR: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message, logs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
