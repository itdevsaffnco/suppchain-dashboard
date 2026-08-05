<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\SheetsService;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __construct(private readonly SheetsService $sheets) {}

    /**
     * GET /api/dashboard — data SKU dari Google Sheets + users dari DB.
     */
    public function index(): JsonResponse
    {
        $sheetsData = $this->sheets->getData();

        $users = User::orderBy('id')
            ->get()
            ->map(fn (User $u) => $u->toDashboardArray())
            ->all();

        return response()->json([
            'skus'       => $sheetsData['skus'],
            'categories' => (object) $sheetsData['categories'],
            'users'      => $users,
        ]);
    }
}
