const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

interface WebhookPayload {
  tenderReferenceNumber: string;
  tenderId: string;
  itemScope: string;
  tenderAuthority: string;
  submissionDate: string;
  assignedTo: { name: string; email: string } | null;
  source: string;
  portalLink: string;
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${day}-${month}-${year} ${displayHours}:${minutes} ${ampm}`;
}

interface TenderWebhookData {
  referenceNo: string;
  itemCategory: string | null;
  organization: string | null;
  deadline: Date | null;
  tenderFileUrl: string | null;
}

export async function sendTenderWebhook(
  tender: TenderWebhookData,
  type: "Gem" | "Non-Gem",
  associations: { association: { name: string; email: string } }[],
) {
  if (!N8N_WEBHOOK_URL) return;

  const payload: WebhookPayload = {
    tenderReferenceNumber: tender.referenceNo,
    tenderId: tender.referenceNo,
    itemScope: tender.itemCategory || "",
    tenderAuthority: tender.organization || "",
    submissionDate: tender.deadline ? formatDate(tender.deadline) : "",
    assignedTo:
      associations.length > 0
        ? {
            name: associations[0].association.name,
            email: associations[0].association.email,
          }
        : null,
    source: type === "Gem" ? "GEM" : "Non-GEM",
    portalLink: tender.tenderFileUrl || "",
  };

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(
        `Webhook returned ${response.status}: ${await response.text()}`,
      );
    }
  } catch (error) {
    console.error("Failed to send webhook:", error);
  }
}
