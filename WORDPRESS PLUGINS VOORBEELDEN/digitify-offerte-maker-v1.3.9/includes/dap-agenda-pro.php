<?php
if ( ! defined('ABSPATH') ) exit;

/**
 * Digitify Offerte Maker -> Digitify Agenda Pro integration.
 * Emits a WP action when a quote is submitted so Agenda Pro can create an agenda item.
 *
 * Hook name: digitify_offerte_ingediend
 * Payload:
 *  - ref
 *  - offerte_id (optional)
 *  - submitted_at (mysql datetime)
 *  - submitted_date (Y-m-d)
 *  - client (array)
 *  - quote (array)
 */
function digitify_offerte_emit_agenda_event( array $payload ): void {
    /**
     * Fires after an offerte (quote) is successfully stored.
     * Other plugins (like Digitify Agenda Pro) can listen and create agenda items.
     */
    do_action( 'digitify_offerte_ingediend', $payload );
}
