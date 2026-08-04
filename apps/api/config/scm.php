<?php

return [
    /*
    |--------------------------------------------------------------------------
    | App API key
    |--------------------------------------------------------------------------
    |
    | Shared secret required on every /api request via the X-App-Key header.
    | Must match APP_API_KEY in the Next.js app's environment.
    |
    */
    'app_key' => env('APP_API_KEY', ''),
];
