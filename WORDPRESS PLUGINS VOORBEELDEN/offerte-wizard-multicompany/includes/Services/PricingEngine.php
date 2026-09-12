<?php
namespace OWMC\Services;

/**
 * Calculates indicative prices from wizard payload.
 *
 * Pricing rules are stored per-service in the wizard schema under
 * the optional `pricing` key:
 *   { "base": 500, "perM2": 25, "perUnit": 0 }
 *
 * Future: load price tables from DB per company.
 */
class PricingEngine {

    public function calculate( array $payload, \stdClass $company ): array {
        $schema   = $this->getSchema( $company );
        $services = $schema['services'] ?? [];
        $diensten = $payload['diensten'] ?? [];

        $lines   = [];
        $subtotal = 0.0;

        foreach ( $diensten as $serviceId ) {
            $svc = $this->findService( $services, $serviceId );
            if ( ! $svc ) continue;

            $pricing = $svc['pricing'] ?? null;
            if ( ! $pricing ) continue;

            $details = $payload['details'][ $serviceId ] ?? [];
            $price   = $this->priceForService( $pricing, $details );

            if ( $price > 0 ) {
                $lines[]   = [
                    'service' => $svc['title'] ?? $serviceId,
                    'price'   => $price,
                ];
                $subtotal += $price;
            }
        }

        $btwRate = (int) ( $company->btw_rate ?? 21 );
        $btwEnabled = (bool) ( $company->btw_enabled ?? true );
        $btw      = $btwEnabled ? round( $subtotal * $btwRate / 100, 2 ) : 0.0;
        $total    = round( $subtotal + $btw, 2 );

        return [
            'lines'       => $lines,
            'subtotal'    => $subtotal,
            'btw_rate'    => $btwRate,
            'btw'         => $btw,
            'btw_enabled' => $btwEnabled,
            'total'       => $total,
            'currency'    => 'EUR',
            'indicative'  => true,
            'valid_days'  => 30,
        ];
    }

    private function priceForService( array $pricing, array $details ): float {
        $base     = (float) ( $pricing['base']    ?? 0 );
        $perM2    = (float) ( $pricing['perM2']   ?? 0 );
        $perUnit  = (float) ( $pricing['perUnit'] ?? 0 );

        $price = $base;

        // Look for area-type answers
        foreach ( [ 'oppervlakte', 'oppervlak', 'area', 'm2' ] as $key ) {
            if ( isset( $details[ $key ] ) && is_numeric( $details[ $key ] ) ) {
                $price += $perM2 * (float) $details[ $key ];
                break;
            }
        }

        // Look for unit-count answers
        foreach ( [ 'aantal', 'inhoud', 'units' ] as $key ) {
            if ( isset( $details[ $key ] ) && is_numeric( $details[ $key ] ) ) {
                $price += $perUnit * (float) $details[ $key ];
                break;
            }
        }

        return max( 0.0, $price );
    }

    private function findService( array $services, string $id ): ?array {
        foreach ( $services as $svc ) {
            if ( ( $svc['id'] ?? '' ) === $id ) return $svc;
        }
        return null;
    }

    private function getSchema( \stdClass $company ): array {
        if ( ! empty( $company->wizard_json ) ) {
            $decoded = json_decode( $company->wizard_json, true );
            if ( is_array( $decoded ) ) return $decoded;
        }
        return [];
    }
}
