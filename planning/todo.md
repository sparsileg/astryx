# To Do or To Investigate

## For Sure

    * Find missing import targets from Admin Tools menu
    * Use Lazy Loading for results from target filtering
    * Normalize data sets in prep for sqlite conversion eventually. Make
      sure that when Locations, Sensors, etc. are deleted, that they are
      just hidden because we don't want to lose data for projects &
      sessions. Or maybe allow deletion only if they are never used. Then,
      just hide them.

## Future Consideration

1. Multi-Night Session Planning

    * Extend Sequence Planner to handle multi-night observing runs
    * Track "remaining time needed" per project across nights
    * Show which targets need more integration time
    
3. Mosaic Planning

    * Calculate panel layouts for large targets
    * Estimate total integration time for complete mosaic
    * Track which panels have been imaged
    
4. Astrobin Integration

    * Track which projects are published
    * Link sessions to uploaded images
    * Integration time verification
    
5. Image Catalog

    * Specify image and thumbnails to create catalogs of Programs
    
6. Seeing & Transparency Standards (notional)

    * Seeing: Bad, Poor, Fair, Good, Excellent
    * Transparency: Very poor, Poor, Fair, Good, Excellent

7. Optimize meridian flips so that there is only one during the night.
   Introduce SSP option to optimize to reduce meridian flips. Unless we
   image only the first part of the evening, there will need to be at least
   one meridian flip. I'm wondering if we can introduce an option to
   minimize meridian flips. This might be to image multiple targets as they
   ascend, pick one for the meridian flip and then image the same targets
   again after the single meridian flip. 
      
