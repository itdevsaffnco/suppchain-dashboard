<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        // Per-category forecast/realisasi totals. These are tracked separately
        // from the SKU trends because the planning numbers are entered at
        // category level, not derived from the SKUs underneath.
        Schema::create('category_weekly', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('week');
            $table->integer('forecast')->default(0);
            $table->integer('realisasi')->default(0);
            $table->timestamps();
            $table->unique(['category_id', 'week']);
        });

        Schema::create('skus', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->string('name')->unique();
            $table->integer('po')->default(0);
            $table->integer('safety')->default(0);
            $table->decimal('daily_demand', 10, 2)->default(0);
            $table->string('tipe_stock')->default('Reguler');
            $table->unsignedInteger('target_simpan')->default(30);
            $table->timestamps();
        });

        Schema::create('sku_weekly', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sku_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('week');
            $table->integer('forecast')->default(0);
            $table->integer('realization')->default(0);
            $table->timestamps();
            $table->unique(['sku_id', 'week']);
        });

        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sku_id')->constrained()->cascadeOnDelete();
            // Human batch label ("B1", "S1"), unique per SKU — not the PK.
            $table->string('batch_code');
            $table->date('date');
            $table->integer('qty_in')->default(0);
            $table->integer('qty_used')->default(0);
            $table->integer('sisa')->default(0);
            $table->timestamps();
            $table->unique(['sku_id', 'batch_code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('batches');
        Schema::dropIfExists('sku_weekly');
        Schema::dropIfExists('skus');
        Schema::dropIfExists('category_weekly');
        Schema::dropIfExists('categories');
    }
};
