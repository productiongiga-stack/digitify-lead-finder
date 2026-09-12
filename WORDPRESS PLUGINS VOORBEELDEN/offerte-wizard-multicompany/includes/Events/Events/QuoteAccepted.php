<?php
namespace OWMC\Events\Events;

class QuoteAccepted extends BaseEvent {
    public function name(): string       { return 'quote_accepted'; }
    public function entityType(): string { return 'lead'; }
}
