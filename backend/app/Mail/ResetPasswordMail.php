<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ResetPasswordMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $resetUrl,
        public string $email,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reset Password — Supply Chain Dashboard',
        );
    }

    public function content(): Content
    {
        return new Content(
            html: 'emails.reset-password',
            with: [
                'resetUrl' => $this->resetUrl,
                'email' => $this->email,
                'name' => explode('@', $this->email)[0],
            ],
        );
    }
}
