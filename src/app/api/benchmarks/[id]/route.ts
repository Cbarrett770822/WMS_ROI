import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Benchmark from '@/models/Benchmark';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Get a specific benchmark
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const benchmarkId = req.url.split('/').pop();
    
    if (!benchmarkId || !mongoose.Types.ObjectId.isValid(benchmarkId)) {
      return NextResponse.json(
        { message: 'Invalid benchmark ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the benchmark
    const benchmark = await Benchmark.findById(benchmarkId)
      .populate('createdBy', 'username firstName lastName');
      
    if (!benchmark) {
      return NextResponse.json(
        { message: 'Benchmark not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ benchmark });
  } catch (error) {
    console.error('Error fetching benchmark:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a benchmark (admin only)
export const PUT = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const benchmarkId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!benchmarkId || !mongoose.Types.ObjectId.isValid(benchmarkId)) {
      return NextResponse.json(
        { message: 'Invalid benchmark ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the benchmark
    const benchmark = await Benchmark.findById(benchmarkId);
    if (!benchmark) {
      return NextResponse.json(
        { message: 'Benchmark not found' },
        { status: 404 }
      );
    }

    // Check for industry and category conflicts if they are being changed
    if ((updateData.industry && updateData.industry !== benchmark.industry) || 
        (updateData.category && updateData.category !== benchmark.category)) {
      
      const existingBenchmark = await Benchmark.findOne({
        industry: updateData.industry || benchmark.industry,
        category: updateData.category || benchmark.category,
        _id: { $ne: benchmarkId }
      });
      
      if (existingBenchmark) {
        return NextResponse.json(
          { message: 'A benchmark for this industry and category already exists' },
          { status: 409 }
        );
      }
    }

    // Update the benchmark
    Object.keys(updateData).forEach(key => {
      if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
        benchmark[key] = updateData[key];
      }
    });
    
    // Update lastModifiedAt
    benchmark.lastModifiedAt = new Date();
    benchmark.lastModifiedBy = user.userId;
    
    await benchmark.save();

    return NextResponse.json({
      message: 'Benchmark updated successfully',
      benchmark
    });
  } catch (error) {
    console.error('Error updating benchmark:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a benchmark (admin only)
export const DELETE = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const benchmarkId = req.url.split('/').pop();
    
    if (!benchmarkId || !mongoose.Types.ObjectId.isValid(benchmarkId)) {
      return NextResponse.json(
        { message: 'Invalid benchmark ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the benchmark
    const benchmark = await Benchmark.findById(benchmarkId);
    if (!benchmark) {
      return NextResponse.json(
        { message: 'Benchmark not found' },
        { status: 404 }
      );
    }

    // Delete the benchmark
    await Benchmark.findByIdAndDelete(benchmarkId);

    return NextResponse.json({
      message: 'Benchmark deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting benchmark:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
