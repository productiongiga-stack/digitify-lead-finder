=== Digitify WhatsApp CTA ===
Contributors: Digitify
Tags: whatsapp, contact, cta, call-to-action, customer-service
Requires at least: 5.0
Requires PHP: 7.2
Tested up to: 6.4
Stable tag: 1.0.0
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Modern, customizable WhatsApp call-to-action button for WordPress sites.

== Description ==

Digitify WhatsApp CTA is a powerful, production-ready WordPress plugin that adds a beautiful, customizable floating WhatsApp button to your website.

Perfect for businesses that want to:
- Provide instant customer support via WhatsApp
- Generate leads by offering quick contact options
- Improve customer engagement
- Reduce bounce rates

Features:
- Modern floating button with smooth animations
- Customizable popup with pre-defined question options
- Full color customization (button, text, popup colors)
- Mobile and desktop specific visibility settings
- Automatic footer injection with duplicate prevention
- Shortcode support for custom placement
- PHP helper function for developers
- Page exclusion options (hide on specific pages)
- WhatsApp link type selection (wa.me or api.whatsapp.com)
- Variable replacement in messages ({{site_name}}, {{company_name}}, {{page_url}}, {{page_title}})
- GDPR-friendly (no external libraries, no cookies)
- Fully accessible with keyboard navigation
- Production-ready code with WordPress security standards
- No jQuery dependency
- Zero external dependencies

== Installation ==

1. Upload the `digitify-whatsapp-cta` folder to the `/wp-content/plugins/` directory
2. OR: Go to WordPress Admin > Plugins > Add New, search "Digitify WhatsApp CTA" and click Install
3. Activate the plugin through the Plugins menu
4. Go to Settings > WhatsApp CTA to configure

== Setup ==

1. **Enable Plugin**: Toggle "Enable Plugin" in settings
2. **Add WhatsApp Number**: Enter your WhatsApp number in international format (e.g., 32470123456 for Belgium, 31612345678 for Netherlands)
   - Format: [country code][number] without + or spaces
   - Example: Belgium (+32 470 123 456) → 32470123456
   - Example: Netherlands (+31 6 12345678) → 31612345678
3. **Configure Display**: Set position, size, colors, and device visibility
4. **Add Questions**: Create custom question options that appear in the popup
5. **Save Settings**: Click "Save Changes"

== Usage ==

=== Automatic Display ===
Enable "Auto-show in Footer" in settings to automatically display the button on all pages.

=== Shortcode ===

Insert the WhatsApp button anywhere using the shortcode:

`[whatsapp_cta]`

Shortcode parameters:
- `mode="floating"` - Fixed floating button (default: inline)
- `mode="inline"` - Inline button in content
- `show_button="1"` - Show the button (default: 1)
- `show_popup="1"` - Show the popup (default: 1)

Examples:
`[whatsapp_cta]` - Inline button
`[whatsapp_cta mode="floating"]` - Floating button
`[whatsapp_cta mode="floating" show_button="1" show_popup="1"]` - Both visible

=== PHP Helper Function ===

Use this function in your theme or plugin:

`<?php digitify_whatsapp_cta( array( 'mode' => 'floating', 'show_button' => true, 'show_popup' => true ) ); ?>`

Parameters:
- `mode` - 'floating' or 'inline' (default: 'floating')
- `show_button` - true/false (default: true)
- `show_popup` - true/false (default: true)

== Settings ==

=== General Settings ===
- **Enable Plugin**: Turn the plugin on or off
- **WhatsApp Number**: Your contact number in international format
- **Company Name**: Used in variable replacement (optional)
- **Auto-show in Footer**: Automatically inject button in footer

=== Display Settings ===
- **Show on Mobile**: Visibility on mobile devices
- **Show on Desktop**: Visibility on desktop devices
- **Button Position**: Bottom-right or bottom-left
- **Button Size**: Pixel size (30-100px)
- **Icon Size**: Icon size within button (16-48px)
- **Border Radius**: Button corner roundness (0-50px)

=== Link Configuration ===
- **Link Type**: wa.me (recommended) or api.whatsapp.com
- **Open in New Tab**: Open WhatsApp link in new tab

=== Styling ===
- **Button Text**: Text shown on button
- **Button Colors**: Customize button appearance
- **Popup Title & Intro**: Header and intro text
- **Popup Colors**: Fully customizable popup appearance

=== Questions & Options ===
Add custom questions that users can select from. Each question can have:
- **Label**: Button text (e.g., "Sales Inquiry")
- **Message**: Pre-filled message sent to WhatsApp

Default questions included:
1. Offerte aanvragen (Request Quote)
2. Vraag stellen (Ask a Question)
3. Afspraak maken (Schedule Appointment)
4. Support (Support)

=== Variable Replacement ===

Use these variables in your message templates:
- `{{site_name}}` - Your website name
- `{{company_name}}` - Company name from settings
- `{{page_title}}` - Current page title
- `{{page_url}}` - Current page URL
- `{{option_label}}` - Selected question label

Example: "Hi, I'm interested in your services. More info: {{page_url}}"

=== Page Exclusions ===
Hide the button on specific pages by entering post IDs or slugs (one per line or comma-separated).

== Filters & Hooks ==

For developers:

- `dwa_should_render` - Control when button is displayed
- `dwa_whatsapp_url` - Customize the final WhatsApp URL
- `dwa_whatsapp_message` - Modify message before sending
- `dwa_button_html` - Customize button markup
- `dwa_popup_html` - Customize popup markup
- `dwa_button_settings` - Modify button configuration
- `dwa_variables` - Add custom variables for replacement

== Security ==

- WordPress Settings API integration
- Input sanitization and validation
- Output escaping on all frontend elements
- Nonce protection on admin forms
- No SQL injection vectors
- No XSS vulnerabilities
- No external dependencies
- GDPR-friendly (no external tracking)

== Browser Support ==

- Chrome/Firefox/Safari (last 2 versions)
- iOS Safari 12+
- Chrome Android

== Frequently Asked Questions ==

**Q: How do I format the WhatsApp number?**
A: Use international format without + or spaces.
Examples: 32470123456 (Belgium), 31612345678 (Netherlands), 447911123456 (UK), 14155552671 (USA)

**Q: Can I customize the button color?**
A: Yes! Go to Settings > WhatsApp CTA > Styling and use the color pickers.

**Q: Can I hide the button on certain pages?**
A: Yes! In Page Exclusions, enter the post IDs or slugs of pages where you want to hide the button.

**Q: Does this plugin use external libraries?**
A: No. It's built with vanilla JavaScript and PHP, with zero external dependencies.

**Q: Is it mobile friendly?**
A: Yes! The plugin is fully responsive and works on all devices.

**Q: Can I use custom text in messages?**
A: Yes! Use variable placeholders: {{site_name}}, {{company_name}}, {{page_title}}, {{page_url}}, {{option_label}}

**Q: Does it work with my theme?**
A: Yes. The plugin uses scoped CSS with the `.dwa-` prefix to avoid conflicts with other themes and plugins.

**Q: Does it affect page speed?**
A: No. The plugin loads minimal CSS and uses efficient vanilla JavaScript.

== Support ==

For support, please visit [Digitify.com](https://digitify.com/whatsapp-cta)

== Changelog ==

= 1.0.0 =
- Initial release
- Floating button with popup
- Full color customization
- Shortcode and PHP helper support
- Settings API integration
- Page exclusion support
- Variable replacement in messages
- Mobile and desktop visibility controls
- Production-ready security implementation

== License ==

This plugin is licensed under the GPL-2.0+ License.
https://www.gnu.org/licenses/gpl-2.0.html

== Credits ==

Developed by [Digitify](https://digitify.com)
