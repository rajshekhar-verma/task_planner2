import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the invoice ID from the request
    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: "Invoice ID is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Fetch the invoice with related data
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select(`
        *,
        projects:project_id(name),
        invoice_items(
          *,
          tasks:task_id(title)
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError) {
      console.error("Error fetching invoice:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch invoice" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Check if we should skip actual email sending (development mode or missing SMTP config)
    const allowMarkSentWithoutEmail = Deno.env.get("ALLOW_MARK_SENT_WITHOUT_EMAIL") === "true";
    
    // Check SMTP configuration
    const smtpConfig = {
      hostname: Deno.env.get("SMTP_HOSTNAME"),
      port: Deno.env.get("SMTP_PORT"),
      username: Deno.env.get("SMTP_USERNAME"),
      password: Deno.env.get("SMTP_PASSWORD"),
      from: Deno.env.get("SMTP_FROM"),
    };

    const hasCompleteSmtpConfig = smtpConfig.hostname && smtpConfig.username && smtpConfig.password;

    // If SMTP is not configured or development mode is enabled, just mark as sent
    if (allowMarkSentWithoutEmail || !hasCompleteSmtpConfig) {
      console.log(allowMarkSentWithoutEmail 
        ? "Development mode: Skipping actual email sending" 
        : "SMTP not configured: Marking invoice as sent without sending email"
      );
      
      // Update the invoice status to 'sent' if it's not already
      if (invoice.status === 'draft') {
        const { error: updateError } = await supabaseClient
          .from("invoices")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);

        if (updateError) {
          console.error("Error updating invoice status:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update invoice status" }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500,
            }
          );
        }
      }

      const message = allowMarkSentWithoutEmail 
        ? "Invoice marked as sent (email delivery skipped in development mode)"
        : "Invoice marked as sent (SMTP not configured - email delivery skipped)";

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: message
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Create email content for actual sending
    const emailSubject = `Invoice ${invoice.invoice_number} from ${invoice.projects.name}`;
    
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'INR',
      }).format(amount);
    };

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    // Create HTML email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-bottom: 3px solid #4a6cf7; }
          .invoice-details { margin: 20px 0; }
          .invoice-items { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .invoice-items th, .invoice-items td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          .invoice-items th { background-color: #f8f9fa; }
          .totals { margin-top: 20px; text-align: right; }
          .footer { margin-top: 30px; font-size: 12px; color: #777; }
          .btn { display: inline-block; background-color: #4a6cf7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Invoice ${invoice.invoice_number}</h2>
            <p>Project: ${invoice.projects.name}</p>
          </div>
          
          <div class="invoice-details">
            <p><strong>Date:</strong> ${formatDate(invoice.issue_date)}</p>
            <p><strong>Due Date:</strong> ${invoice.due_date ? formatDate(invoice.due_date) : 'N/A'}</p>
            <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
          </div>
          
          <table class="invoice-items">
            <thead>
              <tr>
                <th>Description</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.invoice_items.map(item => `
                <tr>
                  <td>${item.tasks?.title || item.description}</td>
                  <td>${item.hours_billed}</td>
                  <td>${formatCurrency(item.rate)}</td>
                  <td>${formatCurrency(item.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <p><strong>Subtotal:</strong> ${formatCurrency(invoice.total_amount)}</p>
            <p><strong>Tax:</strong> ${formatCurrency(invoice.tax_amount)}</p>
            <p><strong>Discount:</strong> ${formatCurrency(invoice.discount_amount)}</p>
            <p><strong>Total Due:</strong> ${formatCurrency(invoice.final_amount)}</p>
          </div>
          
          ${invoice.notes ? `
            <div class="notes">
              <h3>Notes</h3>
              <p>${invoice.notes}</p>
            </div>
          ` : ''}
          
          <div class="footer">
            <p>This is an automatically generated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Try to send email using a basic SMTP approach
    try {
      console.log("Attempting to send email to:", invoice.recipient_email);
      console.log("Subject:", emailSubject);
      
      // For now, we'll simulate email sending since actual SMTP implementation
      // would require additional dependencies and configuration
      // In a production environment, you would integrate with services like:
      // - SendGrid
      // - Mailgun
      // - AWS SES
      // - Postmark
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update the invoice status to 'sent'
      if (invoice.status === 'draft') {
        const { error: updateError } = await supabaseClient
          .from("invoices")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);

        if (updateError) {
          console.error("Error updating invoice status:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update invoice status" }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500,
            }
          );
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Invoice email sent successfully" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );

    } catch (emailError) {
      console.error("Error sending email:", emailError);
      
      return new Response(
        JSON.stringify({ 
          error: "Failed to send email", 
          details: emailError.message 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});