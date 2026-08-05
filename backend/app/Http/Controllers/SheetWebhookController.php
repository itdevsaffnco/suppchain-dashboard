<?php

namespace App\Http\Controllers;

use App\Services\SheetsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SheetWebhookController extends Controller
{
    public function __construct(private readonly SheetsService $sheets) {}

    /**
     * POST /api/sheets/webhook
     * Dipanggil oleh Apps Script onEdit — invalidate cache agar
     * request berikutnya ke /api/dashboard fetch ulang dari Sheets.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $this->sheets->invalidate();
        return response()->json(['ok' => true]);
    }
}
