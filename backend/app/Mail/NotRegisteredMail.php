<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NotRegisteredMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $email) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reset Password — Supply Chain Dashboard',
        );
    }

    public function content(): Content
    {
        return new Content(
            html: 'emails.not-registered',
            with: ['email' => $this->email],
        );
    }
}
