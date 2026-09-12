<?php
namespace OWMC\Events\Events;

class QuoteCreated extends BaseEvent {
    public function name(): string       { return 'quote_created'; }
    public function entityType(): string { return 'lead'; }
}
