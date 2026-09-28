<?php
class ICS {
    public static function generate(
        string $uid,
        string $summary,
        string $description,
        string $startDatetime,
        int $durationMinutes = 30,
        string $organizerEmail = '',
        string $organizerName = '',
        string $attendeeEmail = '',
        string $attendeeName = ''
    ): string {
        $dtStart  = gmdate('Ymd\THis\Z', strtotime($startDatetime));
        $dtEnd    = gmdate('Ymd\THis\Z', strtotime($startDatetime) + ($durationMinutes * 60));
        $dtStamp  = gmdate('Ymd\THis\Z');

        $desc = str_replace(['\n','\r'], ['\\n',''], $description);
        $summ = str_replace(['\n','\r'], [' ',' '], $summary);

        $ics  = "BEGIN:VCALENDAR\r\n";
        $ics .= "VERSION:2.0\r\n";
        $ics .= "PRODID:-//Hulisa CRM//Property Management//EN\r\n";
        $ics .= "CALSCALE:GREGORIAN\r\n";
        $ics .= "METHOD:REQUEST\r\n";
        $ics .= "BEGIN:VEVENT\r\n";
        $ics .= "UID:{$uid}\r\n";
        $ics .= "DTSTAMP:{$dtStamp}\r\n";
        $ics .= "DTSTART:{$dtStart}\r\n";
        $ics .= "DTEND:{$dtEnd}\r\n";
        $ics .= "SUMMARY:{$summ}\r\n";
        $ics .= "DESCRIPTION:{$desc}\r\n";
        $ics .= "STATUS:CONFIRMED\r\n";
        $ics .= "TRANSP:OPAQUE\r\n";
        if ($organizerEmail) {
            $ics .= "ORGANIZER;CN={$organizerName}:mailto:{$organizerEmail}\r\n";
        }
        if ($attendeeEmail) {
            $ics .= "ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN={$attendeeName}:mailto:{$attendeeEmail}\r\n";
        }
        $ics .= "BEGIN:VALARM\r\n";
        $ics .= "TRIGGER:-PT15M\r\n";
        $ics .= "ACTION:DISPLAY\r\n";
        $ics .= "DESCRIPTION:Reminder\r\n";
        $ics .= "END:VALARM\r\n";
        $ics .= "END:VEVENT\r\n";
        $ics .= "END:VCALENDAR\r\n";

        return $ics;
    }

    public static function saveTemp(string $content): string {
        $path = tempnam(sys_get_temp_dir(), 'ics_') . '.ics';
        file_put_contents($path, $content);
        return $path;
    }
}
