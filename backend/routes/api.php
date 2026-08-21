<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\SheetWebhookController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API routes
|--------------------------------------------------------------------------
|
| Every route sits behind the app-key middleware: this API is consumed only
| by the Next.js server, never directly by a browser. Routes that also need a
| signed-in user add Sanctum on top.
|
*/

Route::middleware('app-key')->group(function () {
    // Max 10 attempts per minute per IP to slow down brute-force & email spam.
    // Reset-password lives here too: without a throttle the 64-char token is
    // open to brute forcing and the endpoint to abuse.
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/auth/login', [AuthController::class, 'login']);
        Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
        Route::get('/auth/reset-password', [AuthController::class, 'checkResetToken']);
        Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
    });

    // Webhook dari Google Apps Script onEdit
    Route::post('/sheets/webhook', SheetWebhookController::class);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

        Route::get('/dashboard', [DashboardController::class, 'index']);

        Route::middleware('admin')->group(function () {
            Route::get('/users', [UserController::class, 'index']);
            Route::post('/users', [UserController::class, 'store']);
            Route::patch('/users/{id}', [UserController::class, 'update'])->whereNumber('id');
            Route::delete('/users/{id}', [UserController::class, 'destroy'])->whereNumber('id');
        });
    });
});
