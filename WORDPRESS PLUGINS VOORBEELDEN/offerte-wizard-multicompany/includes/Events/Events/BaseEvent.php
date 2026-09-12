<?php
namespace OWMC\Events\Events;

/**
 * All domain events extend this. Carries the event name + structured payload.
 * Designed to be serializable for future external event hub integration.
 */
abstract class BaseEvent {

    public readonly string $eventId;
    public readonly string $occurredAt;

    public function __construct(
        public readonly array $payload = [],
        public readonly ?int  $companyId = null,
        public readonly ?int  $entityId  = null,
    ) {
        $this->eventId    = wp_generate_uuid4();
        $this->occurredAt = current_time( 'mysql' );
    }

    abstract public function name(): string;

    public function entityType(): ?string {
        return null;
    }

    public function toArray(): array {
        return [
            'event_id'    => $this->eventId,
            'event_name'  => $this->name(),
            'entity_type' => $this->entityType(),
            'entity_id'   => $this->entityId,
            'company_id'  => $this->companyId,
            'payload'     => wp_json_encode( $this->payload, JSON_UNESCAPED_UNICODE ),
            'created_at'  => $this->occurredAt,
        ];
    }
}
