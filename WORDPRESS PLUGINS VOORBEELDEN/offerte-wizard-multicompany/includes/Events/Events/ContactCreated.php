<?php
namespace OWMC\Events\Events;

class ContactCreated extends BaseEvent {
    public function name(): string       { return 'contact_created'; }
    public function entityType(): string { return 'contact'; }
}
