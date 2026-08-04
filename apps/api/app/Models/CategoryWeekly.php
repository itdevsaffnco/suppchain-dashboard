<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['category_id', 'week', 'forecast', 'realisasi'])]
class CategoryWeekly extends Model
{
    protected $table = 'category_weekly';

    protected function casts(): array
    {
        return [
            'week' => 'integer',
            'forecast' => 'integer',
            'realisasi' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
