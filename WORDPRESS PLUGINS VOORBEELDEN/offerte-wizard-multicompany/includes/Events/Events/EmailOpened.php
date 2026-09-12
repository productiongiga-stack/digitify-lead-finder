<?php
namespace OWMC\Events\Events;

class EmailOpened extends BaseEvent {
    public function name(): string       { return 'email_opened'; }
    public function entityType(): string { return 'email_log'; }
}
