const os = require("os");

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch (error) {
  nodemailer = null;
}

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + " VND";
}

function formatMoneyShort(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function getTransporter() {
  if (!nodemailer) return null;
  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT || 587);
  const user = process.env.MAIL_USER;
  const password = process.env.MAIL_PASS;
  const secure = String(process.env.MAIL_SECURE || 'false') === 'true';
  if (!host || !user || !password) return null;
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass: password } });
}

async function sendOrderSuccessMail({
  to,
  customerName,
  orderNumber,
  items = [],
  totalAmount = 0,
  originalAmount = 0,
  shippingFee = 0,
  discountAmount = 0,
  address = '',
  phone = '',
  note = '',
  shopName = process.env.SHOP_NAME || 'KINGSPORT'
}) {
  const transporter = getTransporter();
  if (!transporter || !to) return { skipped: true };

  const from = process.env.MAIL_FROM || process.env.MAIL_USER;
  const subject = `[${shopName}] Xác nhận đặt hàng thành công - Đơn ${orderNumber}`;
  const safeName = escapeHtml(customerName || 'bạn');
  const safeAddress = escapeHtml(address || 'Chưa cập nhật');
  const safePhone = escapeHtml(phone || 'Chưa cập nhật');
  const safeNote = escapeHtml(note || 'Không có');
  const safeShopName = escapeHtml(shopName);

  const linesHtml = items.map((item) => {
    const sizePart = item.size ? ` - Size ${escapeHtml(item.size)}` : '';
    const colorPart = item.colorName ? ` - ${escapeHtml(item.colorName)}` : '';
    return `<li style="margin:0 0 10px 0;">${escapeHtml(item.title || 'Sản phẩm')}${sizePart}${colorPart} - ${Number(item.quantity || 0)} x ${formatMoney(item.price || 0)}</li>`;
  }).join('');

  const brandColor = process.env.SHOP_PRIMARY_COLOR || '#2563eb';
  const brandDark = process.env.SHOP_DARK_COLOR || '#0f172a';
  const logoUrl = process.env.SHOP_LOGO_URL || '';
  const itemsTableRows = items.map((item, index) => {
    const variantParts = [];
    if (item.size) variantParts.push(`Size ${escapeHtml(item.size)}`);
    if (item.colorName) variantParts.push(escapeHtml(item.colorName));
    const variantText = variantParts.length ? `<div style="margin-top:4px;color:#64748b;font-size:13px;">${variantParts.join(' • ')}</div>` : '';
    return `
      <tr>
        <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;vertical-align:top;">${index + 1}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;vertical-align:top;">
          <div style="font-weight:700;">${escapeHtml(item.title || 'Sản phẩm')}</div>
          ${variantText}
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;text-align:center;vertical-align:top;">${Number(item.quantity || 0)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;text-align:right;vertical-align:top;">${formatMoneyShort(item.price || 0)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;text-align:right;vertical-align:top;font-weight:700;">${formatMoneyShort((Number(item.price || 0) * Number(item.quantity || 0)))}</td>
      </tr>`;
  }).join('');

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeShopName}" style="height:48px;display:block;" />`
    : `<div style="display:inline-block;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.12);color:#fff;font-size:20px;font-weight:800;letter-spacing:0.5px;">${safeShopName}</div>`;

  const html = `
  <div style="background:#eef2f7;padding:28px 12px;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #dbe4f0;box-shadow:0 16px 40px rgba(15,23,42,0.08);">
      <div style="background:linear-gradient(135deg, ${brandDark}, ${brandColor});padding:26px 28px;color:#ffffff;">
        ${logoBlock}
        <div style="margin-top:18px;font-size:26px;font-weight:800;line-height:1.3;">Cảm ơn bạn đã đặt hàng tại ${safeShopName}</div>
        <div style="margin-top:8px;font-size:15px;line-height:1.6;opacity:0.95;">Đơn hàng của bạn đã được tạo thành công. Shop đã nhận được thông tin và sẽ xử lý sớm nhất có thể.</div>
      </div>

      <div style="padding:28px 24px 14px;">
        <div style="font-size:26px;font-weight:800;color:#0f172a;margin-bottom:8px;">Chào ${safeName},</div>
        <div style="font-size:15px;line-height:1.7;color:#475569;margin-bottom:20px;">Cảm ơn bạn đã tin tưởng mua sắm tại ${safeShopName}. Dưới đây là thông tin đơn hàng của bạn.</div>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:20px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Mã đơn hàng</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a;">#${escapeHtml(orderNumber)}</div>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:16px;padding:16px;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Tổng thanh toán</div>
            <div style="font-size:22px;font-weight:800;color:${brandColor};">${formatMoney(totalAmount)}</div>
          </div>
        </div>

        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-bottom:18px;">
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:14px;">Thông tin nhận hàng</div>
          <div style="font-size:15px;line-height:1.8;color:#334155;">
            <div><strong>Địa chỉ:</strong> ${safeAddress}</div>
            <div><strong>Số điện thoại:</strong> ${safePhone}</div>
            <div><strong>Ghi chú:</strong> ${safeNote}</div>
          </div>
        </div>

        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-bottom:18px;">
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:14px;">Chi tiết đơn hàng</div>
          <div style="overflow:hidden;border:1px solid #e2e8f0;border-radius:14px;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:12px 10px;color:#475569;font-size:13px;text-align:left;">#</th>
                  <th style="padding:12px 10px;color:#475569;font-size:13px;text-align:left;">Sản phẩm</th>
                  <th style="padding:12px 10px;color:#475569;font-size:13px;text-align:center;">SL</th>
                  <th style="padding:12px 10px;color:#475569;font-size:13px;text-align:right;">Đơn giá</th>
                  <th style="padding:12px 10px;color:#475569;font-size:13px;text-align:right;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${itemsTableRows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#64748b;">Không có sản phẩm</td></tr>'}
              </tbody>
            </table>
          </div>

          <div style="margin-top:16px;background:#f8fafc;border-radius:14px;padding:16px;">
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:14px;color:#475569;margin-bottom:8px;"><span>Tổng tiền hàng</span><strong style="color:#0f172a;">${formatMoney(originalAmount)}</strong></div>
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:14px;color:#475569;margin-bottom:8px;"><span>Phí ship</span><strong style="color:#0f172a;">${formatMoney(shippingFee)}</strong></div>
            ${Number(discountAmount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;gap:12px;font-size:14px;color:#475569;margin-bottom:8px;"><span>Giảm giá</span><strong style="color:#dc2626;">-${formatMoney(discountAmount)}</strong></div>` : ''}
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:16px;color:#0f172a;border-top:1px dashed #cbd5e1;padding-top:12px;margin-top:12px;"><span style="font-weight:700;">Tổng thanh toán</span><strong style="font-size:20px;color:${brandColor};">${formatMoney(totalAmount)}</strong></div>
          </div>
        </div>

        <div style="font-size:15px;line-height:1.7;color:#475569;margin-bottom:22px;">Chúng tôi sẽ liên hệ và xử lý đơn hàng của bạn trong thời gian sớm nhất. Cảm ơn bạn đã đồng hành cùng ${safeShopName}.</div>
      </div>

      <div style="padding:20px 24px;background:#0f172a;color:#e2e8f0;">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px;">${safeShopName}</div>
      </div>
    </div>
  </div>`;

  const textLines = [
    `Chao ${customerName || 'ban'},`,
    `Cam on ban da dat hang tai ${shopName}.`,
    'Day la thong tin don hang cua ban:',
    '',
    `Ma don hang: ${orderNumber}`,
    `Dia chi: ${address || 'Chua cap nhat'}`,
    `So dien thoai: ${phone || 'Chua cap nhat'}`,
    `Ghi chu: ${note || 'Khong co'}`,
    `Tong tien hang: ${formatMoney(originalAmount)}`,
    `Phi ship: ${formatMoney(shippingFee)}`,
    Number(discountAmount || 0) > 0 ? `Giam gia: ${formatMoney(discountAmount)}` : null,
    `Tong thanh toan: ${formatMoney(totalAmount)}`,
    '',
    'Chi tiet don hang:'
  ].filter(Boolean);

  items.forEach((item) => {
    const sizePart = item.size ? ` - Size ${item.size}` : '';
    const colorPart = item.colorName ? ` - ${item.colorName}` : '';
    textLines.push(`- ${item.title || 'San pham'}${sizePart}${colorPart} - ${Number(item.quantity || 0)} x ${formatMoney(item.price || 0)}`);
  });

  textLines.push('', 'Chung toi se xu ly don hang cua ban som nhat co the.', '', 'Tran trong,', `${shopName} Team`);

  await transporter.sendMail({ from, to, subject, text: textLines.join(os.EOL), html });
  return { sent: true };
}

module.exports = { sendOrderSuccessMail };
