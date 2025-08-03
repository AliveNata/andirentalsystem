import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { SmtpClient } from "npm:smtp@0.1.4";

// Update CORS headers to be more specific and include all required headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

interface EmailData {
  to: string;
  bookingCode: string;
  customerName: string;
  carType: string;
  rentalDuration: string;
  startDate: string;
  startTime: string;
  endDate: string;
  identityType: string;
}

Deno.serve(async (req) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Log the incoming request
    console.log('Received request:', {
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
    });

    let emailData: EmailData;
    try {
      emailData = await req.json();
      console.log('Parsed email data:', emailData);
    } catch (error) {
      console.error('Error parsing request body:', error);
      throw new Error('Invalid request body');
    }

    // Validate required environment variables
    const smtpUsername = Deno.env.get('SMTP_USERNAME');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');

    if (!smtpUsername || !smtpPassword) {
      console.error('Missing SMTP configuration');
      throw new Error('SMTP configuration is missing');
    }

    // Configure SMTP client
    const client = new SmtpClient();
    
    try {
      console.log('Connecting to SMTP server...');
      await client.connectTLS({
        hostname: "smtp.gmail.com",
        port: 465,
        username: smtpUsername,
        password: smtpPassword,
      });
      console.log('Connected to SMTP server');

      // Format dates
      const startDate = new Date(emailData.startDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const endDate = new Date(emailData.endDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      // Create email content
      const emailContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .booking-code { font-size: 24px; font-weight: bold; color: #ff6b35; text-align: center; margin: 20px 0; }
            .details { margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 14px; color: #666; }
            .button { background-color: #ff6b35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Konfirmasi Booking - Andi Rental Mobil</h1>
            </div>
            <div class="content">
              <p>Halo ${emailData.customerName},</p>
              <p>Terima kasih telah melakukan booking di Andi Rental Mobil. Berikut adalah detail booking Anda:</p>
              
              <div class="booking-code">
                Kode Booking: ${emailData.bookingCode}
              </div>
              
              <div class="details">
                <h3>Detail Penyewaan:</h3>
                <ul>
                  <li>Tipe Mobil: ${emailData.carType}</li>
                  <li>Durasi Sewa: ${emailData.rentalDuration === 'daily' ? 'Harian' : 'Bulanan'}</li>
                  <li>Tanggal Mulai: ${startDate} ${emailData.startTime}</li>
                  <li>Tanggal Selesai: ${endDate}</li>
                  <li>Tipe Identitas: ${emailData.identityType}</li>
                </ul>
              </div>

              <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="color: #e65100; font-weight: bold;">Penting:</p>
                <p>Mohon segera melakukan pembayaran dalam waktu 1x24 jam untuk mengkonfirmasi booking Anda. Setelah melakukan pembayaran, silakan hubungi admin kami untuk konfirmasi.</p>
              </div>

              <p>Jika Anda memiliki pertanyaan, silakan hubungi tim kami:</p>
              <ul>
                <li>WhatsApp: 081234567890</li>
                <li>Email: info@andirental.com</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>Email ini dibuat secara otomatis, mohon tidak membalas email ini.</p>
              <p>&copy; 2025 Andi Rental Mobil. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
      `;

      console.log('Sending email...');
      await client.send({
        from: "Andi Rental Mobil <noreply@andirental.com>",
        to: emailData.to,
        subject: `Konfirmasi Booking - ${emailData.bookingCode}`,
        content: emailContent,
        html: emailContent,
      });
      console.log('Email sent successfully');

      await client.close();
      console.log('SMTP connection closed');

      return new Response(
        JSON.stringify({ message: 'Email sent successfully' }),
        { 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          }
        }
      );
    } catch (error) {
      console.error('Error in email sending process:', error);
      throw error;
    } finally {
      // Ensure client is always closed
      try {
        await client.close();
        console.log('SMTP connection closed in finally block');
      } catch (e) {
        console.error('Error closing SMTP connection:', e);
      }
    }
  } catch (error) {
    console.error('Error in main handler:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send email', 
        details: error.message 
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500
      }
    );
  }
});