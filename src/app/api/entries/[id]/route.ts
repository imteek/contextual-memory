import { NextRequest, NextResponse } from 'next/server';
import { dbConnect, Entry } from '@/lib/database';
import mongoose from 'mongoose';
import { getAuthenticatedUser } from '@/lib/auth/session';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET a single entry by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate user
    const userData = await getAuthenticatedUser(request);
    if (!userData) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    // Validate ID
    if (!params.id || !mongoose.isValidObjectId(params.id)) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Invalid entry ID'
        },
        { status: 400 }
      );
    }
    
    // Find entry
    const entry = await Entry.findOne({
      _id: new mongoose.Types.ObjectId(params.id),
      userId: new mongoose.Types.ObjectId(userData.id)
    }).lean();
    
    if (!entry) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Entry not found'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      data: entry
    });
  } catch (error) {
    console.error('Error fetching entry:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to fetch entry',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// PUT (update) an entry
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const { id } = params;
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid entry ID format' },
        { status: 400 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    
    // Find and update the entry
    const updatedEntry = await Entry.findByIdAndUpdate(
      id,
      {
        $set: {
          content: body.content,
          files: body.files,
          projectId: body.projectId ? new mongoose.Types.ObjectId(body.projectId) : undefined,
          tags: body.tags,
          linkedEntries: body.linkedEntries
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedEntry) {
      return NextResponse.json(
        { status: 'error', message: 'Entry not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      data: updatedEntry
    });
  } catch (error) {
    console.error('Error updating entry:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to update entry',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// DELETE an entry by ID
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate user
    const userData = await getAuthenticatedUser(request);
    if (!userData) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    // Validate ID
    if (!params.id || !mongoose.isValidObjectId(params.id)) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Invalid entry ID'
        },
        { status: 400 }
      );
    }
    
    const entryId = new mongoose.Types.ObjectId(params.id);
    const userId = new mongoose.Types.ObjectId(userData.id);
    
    // Find entry before deleting (to verify ownership)
    const entry = await Entry.findOne({
      _id: entryId,
      userId: userId
    });
    
    if (!entry) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Entry not found or you do not have permission to delete it'
        },
        { status: 404 }
      );
    }
    
    // Before deleting, clean up references to this entry in other entries
    try {
      // Find all entries that have this entry in their linkedEntries array
      const entriesWithLinks = await Entry.find({
        userId: userId,
        'linkedEntries.entryId': entryId
      });
      
      // Remove references to the deleted entry from each one
      const updatePromises = entriesWithLinks.map(linkedEntry => 
        Entry.updateOne(
          { _id: linkedEntry._id },
          { $pull: { linkedEntries: { entryId: entryId } } }
        )
      );
      
      // Wait for all updates to complete
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        console.log(`Removed references to entry ${params.id} from ${updatePromises.length} other entries`);
      }
    } catch (error) {
      console.error('Error cleaning up entry references:', error);
      // Continue with deletion even if cleanup fails
    }
    
    // Delete the entry
    const result = await Entry.deleteOne({
      _id: entryId,
      userId: userId
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Entry not found or you do not have permission to delete it'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting entry:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to delete entry',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 