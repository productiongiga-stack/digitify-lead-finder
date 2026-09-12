<?php
namespace OWMC\Events\Events;

class EmailSent extends BaseEvent {
    public function name(): string       { return 'email_sent'; }
    public function entityType(): string { return 'email_log'; }
}
