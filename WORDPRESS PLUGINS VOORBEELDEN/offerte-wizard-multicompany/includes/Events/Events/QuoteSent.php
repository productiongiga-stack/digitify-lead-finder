<?php
namespace OWMC\Events\Events;

class QuoteSent extends BaseEvent {
    public function name(): string       { return 'quote_sent'; }
    public function entityType(): string { return 'lead'; }
}
