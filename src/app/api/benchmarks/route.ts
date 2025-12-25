import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Benchmark from '@/models/Benchmark';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';

// Get all benchmarks
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const industry = url.searchParams.get('industry');
    const category = url.searchParams.get('category');
    
    // Connect to the database
    await connectToDatabase();

    let query: any = {};
    
    // Filter by industry if provided
    if (industry) {
      query.industry = industry;
    }
    
    // Filter by category if provided
    if (category) {
      query.category = category;
    }

    // Get benchmarks
    const benchmarks = await Benchmark.find(query)
      .sort({ industry: 1, category: 1, createdAt: -1 });

    return NextResponse.json({ benchmarks });
  } catch (error) {
    console.error('Error fetching benchmarks:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new benchmark (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const benchmarkData = await req.json();

    // Validate required fields
    if (!benchmarkData.industry || !benchmarkData.category || !benchmarkData.metrics) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if benchmark with same industry and category already exists
    const existingBenchmark = await Benchmark.findOne({
      industry: benchmarkData.industry,
      category: benchmarkData.category
    });
    
    if (existingBenchmark) {
      return NextResponse.json(
        { message: 'A benchmark for this industry and category already exists' },
        { status: 409 }
      );
    }

    // Create the benchmark
    const benchmark = new Benchmark({
      ...benchmarkData,
      createdBy: user.userId,
      createdAt: new Date()
    });
    
    await benchmark.save();

    return NextResponse.json(
      { message: 'Benchmark created successfully', benchmark },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating benchmark:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
