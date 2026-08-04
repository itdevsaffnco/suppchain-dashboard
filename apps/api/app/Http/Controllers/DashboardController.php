<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Sku;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    /**
     * GET /api/dashboard — the full dataset in the shape lib/dashboard.ts
     * `DashboardData` expects: { skus, categories, users }.
     */
    public function index(): JsonResponse
    {
        $skus = Sku::with(['category', 'weeklies', 'batches'])
            ->orderBy('id')
            ->get()
            ->map(fn (Sku $sku) => $sku->toDashboardArray())
            ->all();

        $categories = Category::with('weeklies')
            ->orderBy('id')
            ->get()
            ->mapWithKeys(fn (Category $c) => [$c->name => $c->toDashboardArray()])
            ->all();

        $users = User::orderBy('id')
            ->get()
            ->map(fn (User $u) => $u->toDashboardArray())
            ->all();

        return response()->json([
            'skus' => $skus,
            // Force an object even when empty — an empty PHP array would
            // serialize as [] and break Object.keys() on the client.
            'categories' => (object) $categories,
            'users' => $users,
        ]);
    }
}
