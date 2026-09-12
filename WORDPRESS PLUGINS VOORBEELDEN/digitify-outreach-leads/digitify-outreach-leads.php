<?php
/**
 * Plugin Name: Digitify Outreach Leads
 * Description: Lead-only outreach module (manual emailing, tags, timelines) with CRM Core sync (email as unique key).
 * Version: 2.0.1
 * Author: Digitify
 * License: GPL-2.0+
 * Text Domain: digitify-outreach-leads
 */

if (!defined('ABSPATH')) exit;

define('DOL_VERSION', '2.0.1');
define('DOL_PLUGIN_FILE', __FILE__);
define('DOL_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DOL_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once DOL_PLUGIN_DIR . 'Core/Bootstrap.php';

register_activation_hook(__FILE__, ['DOL\\Core\\Bootstrap', 'activate']);
register_deactivation_hook(__FILE__, ['DOL\\Core\\Bootstrap', 'deactivate']);

add_action('plugins_loaded', ['DOL\\Core\\Bootstrap', 'init']);
