<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['sku_id', 'week', 'forecast', 'realization'])]
class SkuWeekly extends Model
{
    protected $table = 'sku_weekly';

    protected function casts(): array
    {
        return [
            'week' => 'integer',
            'forecast' => 'integer',
            'realization' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Sku, $this>
     */
    public function sku(): BelongsTo
    {
        return $this->belongsTo(Sku::class);
    }
}
