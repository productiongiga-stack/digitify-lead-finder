<?php
if ( ! defined('ABSPATH') ) exit;

/**
 * Small utility helpers for minutes/hours conversions.
 * Keeps all time formatting consistent across UI + exports.
 */
class DAP_Time {
	/**
	 * Clamp minutes to a safe integer range.
	 */
	public static function clamp_minutes( $minutes ) {
		$minutes = (int) $minutes;
		if ( $minutes < 0 ) $minutes = 0;
		if ( $minutes > 999999 ) $minutes = 999999;
		return $minutes;
	}

	/**
	 * Format minutes to "12u 30m".
	 */
	public static function format_minutes( $minutes ) {
		$minutes = self::clamp_minutes( $minutes );
		$h = (int) floor( $minutes / 60 );
		$m = (int) ( $minutes % 60 );
		return sprintf( '%du %02dm', $h, $m );
	}
}
